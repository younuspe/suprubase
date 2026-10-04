console.log('Object.keys(global).filter(k => k.toLowerCase().includes("electron")):', 
  Object.keys(global).filter(k => k.toLowerCase().includes("electron")));
console.log('Object.keys(global).filter(k => k.toLowerCase().includes("app")):', 
  Object.keys(global).filter(k => k.toLowerCase().includes("app")));
console.log('Object.keys(global).filter(k => k.toLowerCase().includes("browser")):', 
  Object.keys(global).filter(k => k.toLowerCase().includes("browser")));
console.log('Object.keys(process).filter(k => k.toLowerCase().includes("electron")):', 
  Object.keys(process).filter(k => k.toLowerCase().includes("electron")));
