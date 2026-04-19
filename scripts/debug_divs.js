import fs from 'fs';

const content = fs.readFileSync('components/ProfilePage.tsx', 'utf-8');
const lines = content.split('\n');

let depth = 0;
lines.forEach((line, i) => {
  const opens = (line.match(/<div(?![^>]*\/>)/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  const prevDepth = depth;
  depth += opens - closes;
  if (opens > 0 || closes > 0) {
      if ( (i+1) > 1550 && (i+1) < 1580 ) {
          console.log(`${i + 1}: depth ${prevDepth} -> ${depth} | ${line.trim()}`);
      }
      if ( (i+1) > 390 && (i+1) < 410 ) {
           console.log(`${i + 1}: depth ${prevDepth} -> ${depth} | ${line.trim()}`);
      }
      if ( (i+1) > 1880 && (i+1) < 1900 ) {
           console.log(`${i + 1}: depth ${prevDepth} -> ${depth} | ${line.trim()}`);
      }
  }
});
