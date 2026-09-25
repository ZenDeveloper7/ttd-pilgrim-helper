const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Input {
  constructor(label) { this.label = label; this._value = ''; this.disabled = false; this.readOnly = false; this.type = 'text'; this.labels = [{ textContent: label }]; this.id = ''; }
  get value() { return this._value; }
  set value(v) { this._value = v; }
  getAttribute(k) { return k === 'name' ? '' : null; }
  getClientRects() { return [1]; }
  closest() { return null; }
  dispatchEvent() { return true; }
}
class Select extends Input {
  constructor(label, values) { super(label); this.options = values.map(v => ({ value: v, textContent: v })); }
}
class Textarea extends Input {}
const fields = [new Input('Name'), new Input('Age'), new Select('Gender', ['Male','Female']), new Input('Aadhaar Number'), new Input('Name'), new Input('Age'), new Select('Gender', ['Male','Female']), new Input('Aadhaar Number')];
const actions = ['Continue', 'Pay Now'].map(text => ({textContent:text, disabled:false, getAttribute:()=>null, getClientRects:()=>[1], click(){this.clicked=true;}}));
const document = { querySelectorAll(selector) { return selector.startsWith('input:not') ? fields : selector.startsWith('button') ? actions : []; }, documentElement: {} };
let listener;
const context = { chrome:{runtime:{onMessage:{addListener(fn){listener=fn;}},sendMessage(_message, callback){callback?.();}}}, document, HTMLInputElement:Input, HTMLSelectElement:Select, HTMLTextAreaElement:Textarea, getComputedStyle:()=>({display:'block',visibility:'visible'}), Event:class{}, MutationObserver:class{observe(){} disconnect(){}}, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'content.js'),'utf8'), context);
const send = message => new Promise(resolve => listener(message, {}, resolve));
(async()=>{
 const check=await send({type:'CHECK'});
 assert.match(check.message,/name: 2/);
 const result=await send({type:'FILL',people:[{name:'Example One',age:'30',gender:'Male',idNumber:'111111111111'},{name:'Example Two',age:'28',gender:'Female',idNumber:'222222222222'}]});
 assert.equal(result.ok,true); assert.match(result.message,/Filled 8 fields/);
 assert.equal(fields[0].value,'Example One'); assert.equal(fields[4].value,'Example Two');
 assert.equal(fields[2].value,'Male'); assert.equal(fields[6].value,'Female');
 const run=await send({type:'RUN_ALL',people:[{name:'Example One',age:'30',gender:'Male',idNumber:'111111111111'},{name:'Example Two',age:'28',gender:'Female',idNumber:'222222222222'}]});
 assert.equal(run.ok,true); assert.equal(actions[0].clicked,true); assert.equal(actions[1].clicked,true);
 console.log('Content script field check, two-person fill, and Run All passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
