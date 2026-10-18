using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Drawing;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Win32;

public class Package { public string Id, Arch, File, Sha256, Version; public long Size; }
public class Manifest { public string Bundle; public Package[] Packages; }
public class State { public string Root, Version, Arch, Workspace, Data; public Dictionary<string,string> Files; }
public static class Kit {
    public const string Owner = "PEMARA-OpenCode-Offline-v1";
    // Desktop carries thousands of dependency paths. The same bound must apply
    // to writing installed.json and reading it from the launcher/uninstaller.
    public static JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };
    public static string Exe = Assembly.GetExecutingAssembly().Location;
    public static string Arch() {
        string a = Environment.GetEnvironmentVariable("PROCESSOR_ARCHITEW6432") ?? Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE") ?? "";
        if(a.Equals("ARM64",StringComparison.OrdinalIgnoreCase)) return "arm64";
        if(Environment.Is64BitOperatingSystem) return "x64";
        throw new Exception("Este pacote requer Windows 10 ou 11 de 64 bits (Intel/AMD ou ARM64).");
    }
    public static string Hash(string path) { using(var s=File.OpenRead(path)) using(var h=SHA256.Create()) return BitConverter.ToString(h.ComputeHash(s)).Replace("-", "").ToLowerInvariant(); }
    public static void VerifyPackage(string path,Package p) { if(new FileInfo(path).Length!=p.Size || Hash(path)!=p.Sha256) throw new Exception("Pacote corrompido: "+p.File+". Obtenha outra cópia do instalador."); }
    public static string Safe(string root, string relative) {
        root=Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
        if(Path.IsPathRooted(relative) || relative.Contains(":")) throw new Exception("Caminho inseguro no pacote.");
        string full=Path.GetFullPath(Path.Combine(root,relative));
        if(!full.StartsWith(root,StringComparison.OrdinalIgnoreCase)) throw new Exception("Arquivo fora da pasta autorizada.");
        return full;
    }
    public static void NoLinks(string path) {
        for(var d=new DirectoryInfo(Path.GetFullPath(path));d!=null;d=d.Parent)
            if(d.Exists && (d.Attributes & FileAttributes.ReparsePoint)!=0) throw new Exception("Escolha uma pasta sem links ou redirecionamentos: "+d.FullName);
    }
    public static void Target(string root) {
        root=Path.GetFullPath(root); NoLinks(root);
        if(root.TrimEnd('\\').Equals(Path.GetPathRoot(root).TrimEnd('\\'),StringComparison.OrdinalIgnoreCase)) throw new Exception("Escolha uma subpasta exclusiva para as ferramentas.");
        if(Directory.Exists(root) && Directory.EnumerateFileSystemEntries(root).Any()) {
            string marker=Path.Combine(root,".pemara-owner");
            if(!File.Exists(marker) || File.ReadAllText(marker)!=Owner) throw new Exception("A pasta já contém outros arquivos. Escolha uma pasta vazia para preservar os originais.");
        }
    }
    public static void Extract(string file,string target) {
        Directory.CreateDirectory(target);
        using(var zip=ZipFile.OpenRead(file)) foreach(var entry in zip.Entries) {
            if(entry.FullName.EndsWith("/")) continue;
            string dest=Safe(target,entry.FullName); NoLinks(Path.GetDirectoryName(dest));
            Directory.CreateDirectory(Path.GetDirectoryName(dest)); entry.ExtractToFile(dest,false);
        }
    }
    public static string Tool(State s,string id) {
        string baseDir=Path.Combine(s.Version,id);
        if(id=="node") return Directory.GetFiles(baseDir,"node.exe",SearchOption.AllDirectories).Single();
        if(id=="python") return Path.Combine(baseDir,"python.exe");
        if(id=="git") return Path.Combine(baseDir,"cmd","git.exe");
        if(id=="desktop") return Path.Combine(baseDir,"OpenCode.exe");
        return Path.Combine(baseDir,"opencode.exe");
    }
    public static ProcessStartInfo EnvironmentFor(State s,string file,string args,bool hidden) {
        var p=new ProcessStartInfo(file,args) {UseShellExecute=false,CreateNoWindow=hidden,WorkingDirectory=s.Workspace};
        string py=Path.GetDirectoryName(Tool(s,"python")),node=Path.GetDirectoryName(Tool(s,"node"));
        string win=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        p.EnvironmentVariables["PATH"]=String.Join(";",new[]{node,py,Path.Combine(py,"Scripts"),Path.GetDirectoryName(Tool(s,"git")),Path.GetDirectoryName(Tool(s,"opencode")),Path.Combine(win,"System32"),win,Path.Combine(win,@"System32\WindowsPowerShell\v1.0")});
        p.EnvironmentVariables.Remove("PYTHONHOME"); p.EnvironmentVariables.Remove("PYTHONPATH");
        p.EnvironmentVariables["PYTHONNOUSERSITE"]="1";
        p.EnvironmentVariables["PYTHONIOENCODING"]="utf-8";
        foreach(string kind in new[]{"CONFIG","DATA","STATE","CACHE"}) p.EnvironmentVariables["XDG_"+kind+"_HOME"]=Path.Combine(s.Data,kind.ToLowerInvariant());
        p.EnvironmentVariables["OPENCODE_DISABLE_AUTOUPDATE"]="true";
        p.EnvironmentVariables["OPENCODE_DISABLE_MODELS_FETCH"]="true";
        p.EnvironmentVariables["PIP_DISABLE_PIP_VERSION_CHECK"]="1";
        p.EnvironmentVariables["PEMARA_DESKTOP_DATA"]=Path.Combine(s.Data,"desktop");
        p.EnvironmentVariables["APPDATA"]=Path.Combine(s.Data,"roaming");
        p.EnvironmentVariables["LOCALAPPDATA"]=Path.Combine(s.Data,"local");
        foreach(string key in new[]{"OPENCODE_CONFIG","OPENCODE_CONFIG_DIR","OPENCODE_CONFIG_CONTENT"})p.EnvironmentVariables.Remove(key);
        p.EnvironmentVariables["PEMARA_DISABLE_UPDATER"]="1";
        p.EnvironmentVariables["PEMARA_AULAS_DIR"]=s.Workspace;
        p.EnvironmentVariables["OPENCODE_SIDECAR_V2"]="0";
        p.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
        return p;
    }
    public static string Run(State s,string file,string args,int timeout=120000) {
        var psi=EnvironmentFor(s,file,args,true); psi.RedirectStandardOutput=true; psi.RedirectStandardError=true; psi.StandardOutputEncoding=Encoding.UTF8;psi.StandardErrorEncoding=Encoding.UTF8;
        using(var p=Process.Start(psi)) {
            var output=p.StandardOutput.ReadToEndAsync(); var error=p.StandardError.ReadToEndAsync();
            if(!p.WaitForExit(timeout)){p.Kill();throw new Exception("Tempo excedido ao verificar "+Path.GetFileName(file));}
            string text=output.Result+error.Result;
            if(p.ExitCode!=0) throw new Exception(Path.GetFileName(file)+" falhou ("+p.ExitCode+"): "+text);
            return text.Trim();
        }
    }
    public static void Check(State s,Action<string> log) {
        log("Node.js: "+Run(s,Tool(s,"node"),"--version"));
        log("npm: "+Run(s,Tool(s,"node"),Q(Path.Combine(Path.GetDirectoryName(Tool(s,"node")),@"node_modules\npm\bin\npm-cli.js"))+" --version"));
        log("Python: "+Run(s,Tool(s,"python"),"--version"));
        log("pip: "+Run(s,Tool(s,"python"),"-m pip --version"));
        log("Biblioteca Python: "+Run(s,Tool(s,"python"),"-c \"import ssl,sqlite3,venv,ensurepip; print('SSL, SQLite, venv e ensurepip OK')\""));
        log("Git: "+Run(s,Tool(s,"git"),"--version"));
        log("OpenCode: "+Run(s,Tool(s,"opencode"),"--version"));
        string desktop=Tool(s,"desktop");
        if(!File.Exists(desktop) || !File.Exists(Path.Combine(s.Version,"desktop","resources","app.asar"))) throw new Exception("OpenCode Desktop incompleto.");
        log("OpenCode Desktop: "+FileVersionInfo.GetVersionInfo(desktop).ProductVersion);
    }
    public static string Q(string text) { if(text.Contains("\"")) throw new Exception("Aspas inválidas no caminho."); return "\""+text+"\""; }
    public static State Install(string root,bool integrate,Action<string> log) {
        root=Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar); Target(root); string arch=Arch();
        var manifest=Json.Deserialize<Manifest>(ReadResource("packages.json"));
        Directory.CreateDirectory(root); File.WriteAllText(Path.Combine(root,".pemara-owner"),Owner);
        var drive=new DriveInfo(Path.GetPathRoot(root)); if(drive.AvailableFreeSpace<4000000000L) throw new Exception("São necessários 4 GB livres para instalar.");
        string version=Safe(root,"versions/"+manifest.Bundle+"-"+arch+"-"+Guid.NewGuid().ToString("N").Substring(0,8));
        string workspace=integrate?Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"OpenCode - Aulas"):Safe(root,"test-data/Aulas de Ciências");
        var s=new State {Root=root,Arch=arch,Version=version,Workspace=workspace,Data=integrate?Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"PemaraOpenCodeData"):Safe(root,"test-data/config")};
        Directory.CreateDirectory(workspace); Directory.CreateDirectory(s.Data); Directory.CreateDirectory(version);
        Directory.CreateDirectory(Path.Combine(s.Data,"desktop"));
        Directory.CreateDirectory(Path.Combine(s.Data,"roaming"));Directory.CreateDirectory(Path.Combine(s.Data,"local"));
        var notify=log;log=msg=>{File.AppendAllText(Path.Combine(version,"installation.log"),msg+Environment.NewLine,Encoding.UTF8);notify(msg);};
        string cache=Path.Combine(version,"packages"); Directory.CreateDirectory(cache);
        using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip")) {
            if(stream==null) throw new Exception("Abra o instalador completo para instalar ou reparar.");
            using(var zip=new ZipArchive(stream,ZipArchiveMode.Read)) {
                foreach(var p in manifest.Packages.Where(x=>x.Arch==arch)) {
                    log("Conferindo e instalando "+p.Id+" "+p.Version+"…");
                    string file=Safe(cache,p.File); var e=zip.GetEntry(p.File); if(e==null) throw new Exception("Pacote ausente: "+p.File);
                    e.ExtractToFile(file,false);
                    VerifyPackage(file,p);
                    Extract(file,Path.Combine(version,p.Id));
                }
                log("Preparando pip sem acessar a internet…");
                Run(s,Tool(s,"python"),"-m ensurepip --upgrade --default-pip"); Check(s,log);
                // Publish only after every tool passed. Existing versions and user data stay intact.
                string launcher=Path.Combine(root,"OpenCode-Aulas.exe");
                string staged=Path.Combine(version,"OpenCode-Aulas.exe"); zip.GetEntry("OpenCode-Aulas.exe").ExtractToFile(staged,false);
                if(File.Exists(launcher))File.Copy(launcher,Path.Combine(version,"previous-launcher.exe"));
                File.Copy(staged,launcher,true);
                zip.GetEntry("LEIA-ME.html").ExtractToFile(Path.Combine(version,"LEIA-ME.html"),false);
                zip.GetEntry("OpenCode-LICENSE.txt").ExtractToFile(Path.Combine(version,"opencode","LICENSE.txt"),false);
            }
        }
        File.WriteAllText(Path.Combine(version,"packages.json"),ReadResource("packages.json"),Encoding.UTF8);
        s.Files=Directory.GetFiles(version,"*",SearchOption.AllDirectories).ToDictionary(f=>f.Substring(root.Length+1),Hash);
        s.Files["OpenCode-Aulas.exe"]=Hash(Path.Combine(root,"OpenCode-Aulas.exe"));
        SaveState(s);
        if(integrate) Integrate(s);
        log("Instalação concluída. Todas as ferramentas foram verificadas."); return s;
    }
    public static string ReadResource(string name) { using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream(name)) {if(s==null)throw new Exception("Recurso ausente: "+name);using(var r=new StreamReader(s))return r.ReadToEnd();} }
    public static void SaveState(State s) {
        // Serialize before touching the previous state. Publish a complete file
        // on the same volume, retaining the previous version for recovery.
        string content=Json.Serialize(s);
        string statePath=Path.Combine(s.Root,"installed.json");
        string pending=Path.Combine(s.Root,"installed-"+Guid.NewGuid().ToString("N")+".pending.json");
        File.WriteAllText(pending,content,Encoding.UTF8);
        if(File.Exists(statePath))File.Replace(pending,statePath,Path.Combine(s.Version,"previous-installed-"+Guid.NewGuid().ToString("N")+".json"));
        else File.Move(pending,statePath);
    }
    public static State Load(string root) {
        root=Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar);
        Target(root); var s=Json.Deserialize<State>(File.ReadAllText(Path.Combine(root,"installed.json")));
        if(!Path.GetFullPath(root).Equals(s.Root,StringComparison.OrdinalIgnoreCase) || !s.Version.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)) throw new Exception("Registro de instalação inválido.");
        return s;
    }
    public static void Shortcut(string path,string target,string args,string workspace) {
        Type type=Type.GetTypeFromProgID("WScript.Shell"); dynamic shell=Activator.CreateInstance(type); dynamic link=shell.CreateShortcut(path);
        link.TargetPath=target; link.Arguments=args; link.WorkingDirectory=workspace; link.Description="OpenCode com Python, Node.js e Git — ambiente do professor"; link.Save();
        System.Runtime.InteropServices.Marshal.FinalReleaseComObject(link); System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
    }
    public static void Integrate(State s) {
        string exe=Path.Combine(s.Root,"OpenCode-Aulas.exe");
        string menu=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"PEMARA OpenCode"); Directory.CreateDirectory(menu);
        Shortcut(Path.Combine(menu,"OpenCode para aulas.lnk"),exe,"/open",s.Workspace);
        Shortcut(Path.Combine(menu,"Guia e minhas aulas.lnk"),exe,"/hub",s.Workspace);
        Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"OpenCode para aulas.lnk"),exe,"/open",s.Workspace);
        using(var key=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\PemaraOpenCodeOffline")) {
            key.SetValue("DisplayName","PEMARA — OpenCode Desktop para aulas (offline)"); key.SetValue("DisplayVersion","2026.10.18.4"); key.SetValue("Publisher","PEMARA — pacote independente");
            key.SetValue("InstallLocation",s.Root); key.SetValue("DisplayIcon",exe); key.SetValue("UninstallString",Q(exe)+" /uninstall");key.SetValue("NoModify",1);key.SetValue("NoRepair",1);
        }
    }
    public static int RemoveOwned(State s) {
        Target(s.Root); int kept=0;
        foreach(var pair in s.Files) {
            string file=Safe(s.Root,pair.Key); NoLinks(Path.GetDirectoryName(file));
            if(!File.Exists(file)) continue;
            if(Hash(file)!=pair.Value || file.Equals(Exe,StringComparison.OrdinalIgnoreCase)){kept++;continue;}
            File.Delete(file);
        }
        // Unknown or modified files, previous versions, lessons and credentials are always preserved.
        return kept;
    }
    public static void Launch(State s) {
        Directory.CreateDirectory(Path.Combine(s.Data,"desktop"));
        Directory.CreateDirectory(Path.Combine(s.Data,"roaming"));Directory.CreateDirectory(Path.Combine(s.Data,"local"));
        var psi=EnvironmentFor(s,Tool(s,"desktop"),"--lang=pt-BR",false);
        Process.Start(psi);
    }
}

public class Wizard : Form {
    Label title=new Label(),intro=new Label(),locationLabel=new Label(); TextBox location=new TextBox(),log=new TextBox();
    Button next=new Button(),cancel=new Button(); ProgressBar progress=new ProgressBar(); int page; bool busy; State state;
    public Wizard() {
        Text="PEMARA | OpenCode para aulas"; Font=new Font("Segoe UI",11); BackColor=Color.White; ForeColor=Color.FromArgb(24,40,58);
        AutoScaleDimensions=new SizeF(96,96);AutoScaleMode=AutoScaleMode.Dpi; ClientSize=new Size(800,540); MinimumSize=new Size(800,540); StartPosition=FormStartPosition.CenterScreen;
        title.SetBounds(32,28,730,60); title.Font=new Font("Segoe UI",23,FontStyle.Bold); title.Text="Prepare seu computador para criar aulas"; title.Anchor=AnchorStyles.Left|AnchorStyles.Top|AnchorStyles.Right;
        intro.SetBounds(34,108,730,150); intro.Text="Crie aulas em uma janela, sem precisar usar terminal.\r\n\r\nOpenCode Desktop + Python + Node.js + Git\r\nTodos os pacotes estão neste instalador. Não é necessário estar conectado para instalar."; intro.Anchor=AnchorStyles.Left|AnchorStyles.Top|AnchorStyles.Right;
        locationLabel.SetBounds(34,280,720,25); locationLabel.Text="&Pasta das ferramentas (seus arquivos de aula ficam em Documentos):";
        location.SetBounds(34,312,730,30); location.Text=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","PemaraOpenCode"); location.AccessibleName="Pasta de instalação"; location.Anchor=AnchorStyles.Left|AnchorStyles.Top|AnchorStyles.Right;
        log.SetBounds(34,265,730,180); log.Multiline=true;log.ReadOnly=true;log.ScrollBars=ScrollBars.Vertical;log.Visible=false;log.Anchor=AnchorStyles.Left|AnchorStyles.Top|AnchorStyles.Right|AnchorStyles.Bottom;log.AccessibleName="Progresso e resultado da instalação";
        progress.SetBounds(34,453,730,12);progress.Visible=false;progress.Anchor=AnchorStyles.Bottom|AnchorStyles.Left|AnchorStyles.Right;
        next.SetBounds(574,484,190,38);next.Text="&Avançar";next.BackColor=Color.FromArgb(0,102,99);next.ForeColor=Color.White;next.FlatStyle=FlatStyle.Flat;next.Anchor=AnchorStyles.Bottom|AnchorStyles.Right;
        cancel.SetBounds(434,484,126,38);cancel.Text="&Cancelar";cancel.Anchor=AnchorStyles.Bottom|AnchorStyles.Right;cancel.Click+=(a,b)=>Close();
        Controls.AddRange(new Control[]{title,intro,locationLabel,location,log,progress,next,cancel});AcceptButton=next;CancelButton=cancel;
        next.Click+=async(a,b)=>await Advance(); FormClosing+=(a,b)=>{if(busy)b.Cancel=true;};
    }
    public async Task Advance() {
        if(page==0) {
            try{Kit.Target(location.Text);Kit.Arch();}catch(Exception e){MessageBox.Show(this,e.Message,"Confira a pasta");return;}
            title.Text="Tudo pronto para instalar";
            intro.Text="O instalador verifica e prepara as ferramentas automaticamente.\r\nReserve 4 GB livres. Não é preciso ser administrador.\r\n\r\nA instalação e a abertura são locais. Para conversar com uma IA online, você precisará de internet e de um provedor configurado. Nenhum modelo de IA está incluído.";
            location.ReadOnly=true;next.Text="&Instalar";page=1;return;
        }
        if(page==2){if(state!=null){try{Kit.Launch(state);}catch(Exception e){MessageBox.Show(this,e.Message,"Não foi possível abrir");return;}}Close();return;}
        busy=true;next.Enabled=false;cancel.Enabled=false;location.Visible=false;locationLabel.Visible=false;log.Visible=true;progress.Visible=true;progress.Style=ProgressBarStyle.Marquee;
        title.Text="Instalando suas ferramentas";intro.Text="Aguarde a conferência dos pacotes e os testes de funcionamento.\r\nOs programas que já existem no computador serão preservados.";
        try {
            string root=location.Text;
            state=await Task.Run(()=>Kit.Install(root,true,msg=>Invoke(new Action(()=>log.AppendText(msg+Environment.NewLine)))));
            title.Text="Seu ambiente está pronto";intro.Text="Abra o atalho “OpenCode para aulas” na Área de Trabalho.\r\nSuas aulas ficam em Documentos\\OpenCode - Aulas.\r\n\r\nO guia de primeiros passos também está no atalho.";progress.Style=ProgressBarStyle.Blocks;progress.Value=100;
        } catch(Exception e){title.Text="A instalação precisa de atenção";intro.Text="Não foi possível concluir. O detalhe está abaixo.\r\nCorrija o problema e abra o instalador novamente; seus originais estão preservados.";log.AppendText("\r\nERRO: "+e.Message);progress.Style=ProgressBarStyle.Blocks;}
        busy=false;page=2;next.Enabled=true;next.Text=state==null?"&Fechar":"&Abrir OpenCode";cancel.Enabled=true;cancel.Text="&Concluir";
    }
    public void CaptureWizard(string path,int step) {
        Show();Application.DoEvents();if(step==1)Advance().Wait();Application.DoEvents();using(var image=new Bitmap(Width,Height)){DrawToBitmap(image,new Rectangle(0,0,Width,Height));image.Save(path);}Close();
    }
}
public class Hub : Form {
    public Hub(State s) {
        Text="OpenCode para aulas";Font=new Font("Segoe UI",12);BackColor=Color.White;ClientSize=new Size(640,440);MinimumSize=new Size(650,480);AutoScaleDimensions=new SizeF(96,96);AutoScaleMode=AutoScaleMode.Dpi;StartPosition=FormStartPosition.CenterScreen;
        var heading=new Label {Text="Seu espaço para criar aulas",Font=new Font("Segoe UI",23,FontStyle.Bold),AutoSize=true,Location=new Point(28,28)};Controls.Add(heading);
        var detail=new Label {Text="As ferramentas estão instaladas neste computador.\r\nA IA depende do provedor que você escolher.",AutoSize=true,Location=new Point(30,93)};Controls.Add(detail);
        string[] labels={"&Abrir OpenCode Desktop","&Minhas aulas","&Guia de primeiros passos"};
        for(int i=0;i<labels.Length;i++){int index=i;var b=new Button {Text=labels[i],Location=new Point(30,160+60*i),Size=new Size(575,46),TextAlign=ContentAlignment.MiddleLeft,Anchor=AnchorStyles.Left|AnchorStyles.Right|AnchorStyles.Top};b.Click+=(a,e)=>{try{if(index==0)Kit.Launch(s);if(index==1)Process.Start(s.Workspace);if(index==2)Process.Start(Path.Combine(s.Version,"LEIA-ME.html"));}catch(Exception ex){MessageBox.Show(this,ex.Message,"Não foi possível abrir");}};Controls.Add(b);}
    }
}
public static class Program {
    [STAThread] public static int Main(string[] args) {
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        try {
            if(args.Length>0 && args[0]=="/open") {Kit.Launch(Kit.Load(Path.GetDirectoryName(Kit.Exe)));return 0;}
            if(args.Length>0 && args[0]=="/test-install") {var lines=new List<string>();try{Kit.Install(args[1],false,m=>lines.Add(m));return 0;}finally{File.WriteAllLines(args[1]+".log",lines,Encoding.UTF8);}}
            if(args.Length>0 && args[0]=="/self-test") {Tests.Run(args[1]);return 0;}
            if(args.Length>0 && args[0]=="/verify") {
                var s=Kit.Load(args[1]);var lines=new List<string>();Kit.Check(s,m=>lines.Add(m));
                string venv=Path.Combine(s.Workspace,"teste-venv-"+Guid.NewGuid().ToString("N").Substring(0,8));
                Kit.Run(s,Kit.Tool(s,"python"),"-m venv "+Kit.Q(venv));lines.Add(Kit.Run(s,Path.Combine(venv,"Scripts","python.exe"),"-m pip --version"));
                lines.Add(Kit.Run(s,Kit.Tool(s,"node"),"-e \"console.log('JavaScript executado: ' + (21*2))\""));
                string git=Path.Combine(s.Workspace,"teste-git-"+Guid.NewGuid().ToString("N").Substring(0,8));lines.Add(Kit.Run(s,Kit.Tool(s,"git"),"init "+Kit.Q(git)));
                File.WriteAllLines(args[1]+".verify.txt",lines,Encoding.UTF8);return 0;
            }
            if(args.Length>0 && args[0]=="/capture") {new Wizard().CaptureWizard(args[1],args.Length>2?1:0);return 0;}
            if(args.Length>0 && args[0]=="/uninstall-worker") {
                if(args.Length>2){try{Process.GetProcessById(Int32.Parse(args[2])).WaitForExit(10000);}catch(ArgumentException){}}
                var s=Kit.Load(args[1]);int kept=Kit.RemoveOwned(s);
                bool registered=false;using(var key=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\PemaraOpenCodeOffline")){registered=key!=null && String.Equals(key.GetValue("InstallLocation") as string,s.Root,StringComparison.OrdinalIgnoreCase);}
                if(registered){
                    foreach(string path in new[]{Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"OpenCode para aulas.lnk"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"PEMARA OpenCode","OpenCode para aulas.lnk"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"PEMARA OpenCode","Guia e minhas aulas.lnk")}) if(File.Exists(path)) File.Delete(path);
                    Registry.CurrentUser.DeleteSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\PemaraOpenCodeOffline",false);
                }
                MessageBox.Show("Ferramentas removidas. Aulas, configurações, versões anteriores e arquivos modificados foram preservados.\r\nArquivos protegidos mantidos: "+kept,"Desinstalação concluída");return 0;
            }
            if(args.Length>0 && args[0]=="/uninstall") {
                if(MessageBox.Show("Remover as ferramentas deste pacote?\r\nSuas aulas e configurações serão preservadas.","Desinstalar",MessageBoxButtons.YesNo)!=DialogResult.Yes)return 0;
                string worker=Path.Combine(Path.GetTempPath(),"Pemara-uninstall-"+Guid.NewGuid().ToString("N")+".exe");File.Copy(Kit.Exe,worker);Process.Start(worker,"/uninstall-worker "+Kit.Q(Path.GetDirectoryName(Kit.Exe))+" "+Process.GetCurrentProcess().Id);return 0;
            }
            if(args.Length>0 && args[0]=="/hub") Application.Run(new Hub(Kit.Load(Path.GetDirectoryName(Kit.Exe))));
            else Application.Run(new Wizard());return 0;
        } catch(Exception e) {if(args.Length>1 && (args[0]=="/test-install"||args[0]=="/self-test"||args[0]=="/verify"))File.AppendAllText(args[1]+".error.txt",e.ToString());else MessageBox.Show(e.Message,"PEMARA OpenCode");return 1;}
    }
}
public static class Tests {
    public static void Run(string folder) {
        Directory.CreateDirectory(folder);var results=new List<string>();
        foreach(string bad in new[]{"../escape.txt","C:\\outside.txt","x:stream","..\\outside.txt"}) {bool refused=false;try{Kit.Safe(folder,bad);}catch{refused=true;}if(!refused)throw new Exception("Traversal aceito: "+bad);results.Add("PASS caminho bloqueado: "+bad);}
        string occupied=Path.Combine(folder,"originais");Directory.CreateDirectory(occupied);File.WriteAllText(Path.Combine(occupied,"aula.txt"),"original");bool blocked=false;try{Kit.Target(occupied);}catch{blocked=true;}if(!blocked)throw new Exception("Pasta ocupada aceita");results.Add("PASS pasta original preservada");
        string owned=Path.Combine(folder,"owned");Directory.CreateDirectory(owned);File.WriteAllText(Path.Combine(owned,".pemara-owner"),Kit.Owner);File.WriteAllText(Path.Combine(owned,"tool.txt"),"tool");File.WriteAllText(Path.Combine(owned,"modified.txt"),"before");File.WriteAllText(Path.Combine(owned,"aula.txt"),"teacher");
        var state=new State{Root=owned,Files=new Dictionary<string,string>{{"tool.txt",Kit.Hash(Path.Combine(owned,"tool.txt"))},{"modified.txt",Kit.Hash(Path.Combine(owned,"modified.txt"))}}};File.WriteAllText(Path.Combine(owned,"modified.txt"),"after");Kit.RemoveOwned(state);
        if(File.Exists(Path.Combine(owned,"tool.txt"))||!File.Exists(Path.Combine(owned,"aula.txt"))||!File.Exists(Path.Combine(owned,"modified.txt")))throw new Exception("Desinstalação não preservou dados");results.Add("PASS desinstalação remove apenas arquivos próprios intactos");
        string zipPath=Path.Combine(folder,"malicious.zip");using(var z=ZipFile.Open(zipPath,ZipArchiveMode.Create)){var e=z.CreateEntry("../escaped.txt");using(var w=new StreamWriter(e.Open()))w.Write("bad");}blocked=false;try{Kit.Extract(zipPath,Path.Combine(folder,"extracted"));}catch{blocked=true;}if(!blocked || File.Exists(Path.Combine(folder,"escaped.txt")))throw new Exception("ZIP traversal");results.Add("PASS ZIP malicioso recusado");
        File.WriteAllLines(Path.Combine(folder,"self-test.txt"),results,Encoding.UTF8);
        string corrupt=Path.Combine(folder,"corrupt.zip");File.WriteAllText(corrupt,"antes");var package=new Package{File="corrupt.zip",Size=new FileInfo(corrupt).Length,Sha256=Kit.Hash(corrupt)};File.WriteAllText(corrupt,"depois");blocked=false;try{Kit.VerifyPackage(corrupt,package);}catch{blocked=true;}if(!blocked)throw new Exception("Corrupção aceita");results.Add("PASS pacote corrompido recusado");
        File.WriteAllLines(Path.Combine(folder,"self-test.txt"),results,Encoding.UTF8);
    }
}
