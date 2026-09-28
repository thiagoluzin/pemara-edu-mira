import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync('src/data/world-source.geojson','utf8'));
const features=source.features.map(f=>({code:f.properties.ADM0_A3,rings:(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).flat().map(r=>r.map(([x,y])=>[+x.toFixed(3),+y.toFixed(3)]))}));
fs.writeFileSync('src/data/world-land.json',JSON.stringify(features));
