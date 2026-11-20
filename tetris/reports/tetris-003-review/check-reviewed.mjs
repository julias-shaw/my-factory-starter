import assert from 'node:assert/strict';
import {TetrisGame,PIECE_TYPES,TETROMINOES,createEmptyBoard} from '../../tetris-003-reviewed/src/game.js';
import {renderLines} from '../../tetris-003-reviewed/src/renderer.js';
const results=[];
function check(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}}
const game=()=>new TetrisGame({random:()=>0.5});
check('Board dimensions and independent rows',()=>{const b=createEmptyBoard();assert.equal(b.length,20);assert(b.every(r=>r.length===10));b[0][0]='I';assert.equal(b[1][0],null);});
check('All seven pieces have four cells and fit at spawn',()=>{assert.equal(PIECE_TYPES.length,7);for(const type of PIECE_TYPES){const g=game();g.nextType=type;assert(g.spawn());assert.equal(g.getCells().length,4);assert.equal(g.collides(g.active),false);}});
check('Wall collision prevents movement',()=>{const g=game();g.active={type:'O',x:0,y:0,rotation:0};assert.equal(g.moveLeft(),false);});
check('Hard drop locks at floor and awards distance points',()=>{const g=game();g.active={type:'O',x:4,y:0,rotation:0};assert.equal(g.hardDrop(),18);assert.equal(g.score,36);assert.equal(g.board[19][4],'O');});
check('Four rotations preserve occupied cells',()=>{for(const type of PIECE_TYPES){const g=game();g.active={type,x:3,y:3,rotation:0};const before=JSON.stringify(g.getCells());for(let i=0;i<4;i++)assert(g.rotate());assert.equal(JSON.stringify(g.getCells()),before);}});
check('Line clear shifts surviving rows',()=>{const g=game();g.board[19].fill('I');g.board[18][0]='T';assert.equal(g.clearLines(),1);assert.equal(g.board[19][0],'T');assert(g.board[0].every(x=>x===null));});
check('One-to-four-line scoring and gravity progression',()=>{for(let n=1;n<=4;n++){const g=game();g.level=2;g.lines=10;for(let y=20-n;y<20;y++){g.board[y].fill('T');g.board[y][9]=null;}g.active={type:'I',rotation:1,x:9-TETROMINOES.I.rotations[1][0][0],y:16};assert.equal(g.collides(g.active),false);g.lockPiece();assert.equal(g.score,[0,100,300,500,800][n]*2);}const g=game(),start=g.gravityInterval;g.level=2;assert(g.gravityInterval<start);});
check('Injected randomness reproduces piece sequence',()=>{const a=game(),b=game();for(let i=0;i<10;i++)assert.equal(a.drawType(),b.drawType());});
check('Normal and game-over frames have 24 rows and <=80 columns',()=>{const g=game();for(const status of ['playing','game-over']){g.status=status;const lines=renderLines(g,{color:false});assert.equal(lines.length,24);assert(lines.every(r=>r.length<=80));if(status==='game-over')assert(lines.join('\n').includes('GAME OVER'));}});
check('Board snapshots cannot mutate core state',()=>{const g=game();const snapshot=g.getBoard({includeActive:false});snapshot[19][0]='I';assert.equal(g.board[19][0],null);});
console.log(JSON.stringify({checks:results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length},null,2));
