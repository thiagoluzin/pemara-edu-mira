// Focused regression: reads package inventories and writes disposable JSON only.
// Does not install, launch tools, create shortcuts or alter the registry.
using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Collections.Generic;
using System.Web.Script.Serialization;
public static class SerializationRegression {
    static void Assert(bool value,string message){if(!value)throw new Exception(message);Console.WriteLine("PASS "+message);}
    public static int Main(string[] args){try{Run(args[0]);return 0;}catch(Exception e){Console.Error.WriteLine(e);return 1;}}
    static void Run(string repo){
        string folder=Path.Combine(repo,"build","opencode","json-regression-"+Guid.NewGuid().ToString("N"),"Professor João");
        string version=Path.Combine(folder,"versions","2026.10.18.4-desktop-x64-fixture");Directory.CreateDirectory(version);File.WriteAllText(Path.Combine(folder,".pemara-owner"),Kit.Owner);
        var manifest=Kit.Json.Deserialize<Manifest>(File.ReadAllText(Path.Combine(repo,"installer","opencode","desktop-packages.json")));
        var s=new State{Root=folder,Version=version,Arch="x64",Workspace=Path.Combine(folder,"Aulas de Ciências"),Data=Path.Combine(folder,"perfil"),Files=new Dictionary<string,string>()};
        // Paths come from the actual x64 packages. Hash placeholders have the
        // exact 64-character format; checksums are verified separately by build.
        foreach(var p in manifest.Packages.Where(p=>p.Arch=="x64"))using(var zip=ZipFile.OpenRead(Path.Combine(repo,"build","opencode","cache",p.File)))foreach(var e in zip.Entries){if(e.FullName.EndsWith("/"))continue;s.Files.Add("versions\\2026.10.18.4-desktop-x64-fixture\\"+p.Id+"\\"+e.FullName.Replace('/','\\'),new string('a',64));}
        int actualFiles=s.Files.Count;string realJson=Kit.Json.Serialize(s);Console.WriteLine("REAL INVENTORY files="+actualFiles+" JSON characters="+realJson.Length);
        bool legacyFailed=false;try{new JavaScriptSerializer().Serialize(s);}catch(InvalidOperationException){legacyFailed=true;}
        Assert(legacyFailed,"reproduces original maxJsonLength error with real package paths");
        Kit.SaveState(s);var loaded=Kit.Load(folder.Replace('\\','/'));
        Assert(loaded.Files.Count==actualFiles && loaded.Workspace==s.Workspace && loaded.Files.All(p=>s.Files[p.Key]==p.Value),"actual inventory survives save and launcher Load including accents/spaces");
        string realHash=Kit.Hash(Path.Combine(folder,"installed.json"));
        for(int i=0;i<100000;i++)s.Files.Add("versions\\stress\\desktop\\node_modules\\module-"+i+"\\lib\\nested\\arquivo-de-teste.js",new string('b',64));
        Kit.SaveState(s);Assert(Kit.Load(folder).Files.Count==s.Files.Count,"larger inventory round trip: "+s.Files.Count+" files");
        Assert(Directory.GetFiles(version,"previous-installed-*.json").Any(f=>Kit.Hash(f)==realHash),"previous installation record preserved exactly");
        string current=Path.Combine(folder,"installed.json"),before=Kit.Hash(current);bool publishFailed=false;
        using(var held=File.Open(current,FileMode.Open,FileAccess.Read,FileShare.Read))try{Kit.SaveState(s);}catch(IOException){publishFailed=true;}
        Assert(publishFailed && Kit.Hash(current)==before,"failed replacement leaves current record intact");
        var small=new State{Root=folder,Version=version,Files=new Dictionary<string,string>()};
        string oldJson=new JavaScriptSerializer().Serialize(small);Assert(Kit.Json.Deserialize<State>(oldJson).Root==folder,"legacy small records remain readable");
        Console.WriteLine("Evidence: "+folder);
    }
}
