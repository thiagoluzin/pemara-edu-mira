import fs from 'node:fs';
import path from 'node:path';

// USERPROFILE remains isolated for OpenCode and its child processes. Windows
// expands that variable when navigating known-folder shortcuts in file dialogs.
// Junctions expose only the ordinary user file folders, without copying them,
// redirecting AppData or changing the user's registry/Windows settings.
export function connectWindowsUserFolders(profile,getPath) {
  const folders={desktop:'Desktop',documents:'Documents',downloads:'Downloads',pictures:'Pictures',music:'Music',videos:'Videos'};
  const result=[];
  const root=path.resolve(profile);
  fs.mkdirSync(root,{recursive:true});
  for(const [key,name] of Object.entries(folders)){
    const target=path.resolve(getPath(key));
    const alias=path.join(root,name);
    if(target===root || target.startsWith(root+path.sep))throw Error('A pasta real do Windows não pode apontar para o perfil isolado: '+key);
    if(!fs.existsSync(target)){result.push({folder:key,path:alias,target,status:'target-unavailable'});continue;}
    const existing=fs.lstatSync(alias,{throwIfNoEntry:false});
    if(existing){
      // Never replace existing teacher files, directories or links.
      result.push({folder:key,path:alias,target,status:existing.isSymbolicLink()&&fs.realpathSync(alias).toLowerCase()===fs.realpathSync(target).toLowerCase()?'connected':'existing-preserved'});
      continue;
    }
    fs.symlinkSync(target,alias,'junction');
    result.push({folder:key,path:alias,target,status:'connected'});
  }
  return result;
}
