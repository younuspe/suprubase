const rs = require('./src/main/roadmapService.js');
console.log('Exported object:', rs);
console.log('Type of exported object:', typeof rs);
if (rs && typeof rs === 'object') {
  console.log('Keys in exported object:', Object.keys(rs));
  if (rs.RoadmapService !== undefined) {
    console.log('Type of rs.RoadmapService:', typeof rs.RoadmapService);
    console.log('Is rs.RoadmapService a function?', typeof rs.RoadmapService === 'function');
    console.log('Is rs.RoadmapService a class?', rs.RoadmapService instanceof Function);
  }
}