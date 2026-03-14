import fs from 'fs';

const rawData = fs.readFileSync('rizz new.txt', 'utf8').replace(/\r/g, '\n');
const blocks = rawData.split(/(?=RIZZ\s+\d+\.|^\d+\.\s+)/m);

blocks.forEach(block => {
    if (block.includes('THE TRUTH')) {
        const qMatch = block.match(/^(?:RIZZ\s+\d+\.|(\d+)\.)\s+(.*)/);
        if (qMatch) {
            console.log(`FOUND: ${qMatch[0].split('\n')[0]}`);
        }
    }
});
