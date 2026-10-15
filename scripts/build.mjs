import fs from 'node:fs';
for(const path of ['public/index.html','src/worker.js','src/game.js'])if(!fs.existsSync(path))throw Error('Missing '+path);
console.log('Lie Detector assets ready.');
