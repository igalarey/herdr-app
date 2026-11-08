const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../main.js'), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export default class Agents extends View', 'class Agents extends View');
const program = { name: 'Pi', key: 'pi', agent: true, icon: 'icons/pi.svg', tint: true };
const space = (id = 's1', machine = null) => ({ id, name: id, machine, tabs: [
  { id: machine ? `${machine}/tab1` : 'tab1', name: 'Work', named: true },
  { id: machine ? `${machine}/tab2` : 'tab2', name: 'Other', named: true },
] });
const agent = (address, extra = {}) => ({ address, pane: `pane-${address}`, space: 's1', space_name: 's1', tab: 'tab1',
  tab_index: 1, tab_name: 'Work', title: address, status: 'working', seq: 0, pinned: false, focused: false, program, ...extra });
const terminal = (address, parent = null, extra = {}) => ({ address, parent, state: 'live', status: 'working', name: address, program, ...extra });

function harness(list, terminals, options = {}) {
  const input = { list, terminals, spaces: [space()], ...options };
  const commands = [], overlays = [], orders = [], storage = new Map();
  const theme = new Proxy({}, { get: () => '#123456' });
  function element() {
    const node = { id: null, children: [], events: {}, styles: [] };
    let proxy;
    proxy = new Proxy(node, { get(target, key) {
      if (key === '_node') return node;
      if (key === 'id') return id => { node.id = id; return proxy; };
      if (key === 'child') return child => { node.children.push(child); return proxy; };
      if (key === 'children') return children => { node.children.push(...children); return proxy; };
      if (key === 'when') return (condition, branch) => condition ? branch(proxy) : proxy;
      if (String(key).startsWith('on_')) return callback => { node.events[key] = callback; return proxy; };
      return (...args) => { node.styles.push([key, ...args]); return proxy; };
    }});
    return proxy;
  }
  class FixedDate extends Date { static now() { return 1700000000000; } }
  const context = vm.createContext({
    View: class {}, div: element, image: element, svg: element, v_flex: element, h_flex: element,
    agents: () => input.list, terminals: () => input.terminals, spaces: () => input.spaces,
    panes: () => [], focused: () => input.focused ?? null, theme: () => theme,
    shared: key => key === 'agents.sort' ? input.sort : undefined,
    setShared: (key, value) => commands.push(['setShared', { key, value }]),
    setAgentOrder: addresses => orders.push(Array.from(addresses)),
    run: (name, args) => commands.push([name, JSON.parse(JSON.stringify(args))]),
    openOverlay: spec => overlays.push(JSON.parse(JSON.stringify(spec))), closeOverlay: () => {},
    props: () => ({}), window: () => ({ platform: 'linux' }),
    layout: () => ({ id: 'sidebar', size: { px: input.collapsed ? 44 : 256 } }),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    Date: FixedDate,
  });
  const Agents = vm.runInContext(`${source}\nAgents;`, context);
  const view = new Agents();
  const cx = { timer: { every() {} }, notify() {}, stop_propagation() {} };
  view.init({}, cx);
  function render() {
    const before = JSON.stringify(input);
    const nodes = [];
    function walk(value) {
      if (!value || typeof value !== 'object') return;
      const node = value._node;
      if (!node) return;
      nodes.push(node);
      node.children.forEach(walk);
    }
    walk(view.render(cx));
    assert.equal(JSON.stringify(input), before, 'render must not mutate terminal/tab ownership');
    const addresses = new Set([...input.list, ...input.terminals].map(item => item.address));
    const rows = nodes.filter(node => [...addresses].some(address => node.id === `ag-${address}` || node.id === `sub-${address}`));
    const rowAddresses = rows.map(node => node.id.replace(/^(ag|sub)-/, ''));
    assert.equal(new Set(rowAddresses).size, rowAddresses.length, 'one visible row per address');
    const navigation = orders.at(-1);
    assert.equal(new Set(navigation).size, navigation.length, 'unique agent navigation');
    assert(navigation.every(address => input.list.some(item => item.address === address)), 'navigation accepts listed agent addresses only');
    return { rows: rows.map(node => node.id), nodes, navigation,
      click(id) { const node = nodes.find(node => node.id === id); assert(node, `missing ${id}`); assert(node.events.on_click); node.events.on_click({}, cx); } };
  }
  return { render, input, view, commands, overlays };
}

test('adopted and unadopted generations form one depth-first tree and supported navigation', () => {
  const h = harness([agent('t1'), agent('t2'), agent('t4')], [terminal('t1'), terminal('t2', 't1'), terminal('t3', 't2'), terminal('t4', 't3')]);
  const r = h.render();
  assert.deepEqual(r.rows, ['ag-t1', 'sub-t2', 'sub-t3', 'sub-t4']);
  assert.deepEqual(r.navigation, ['t1', 't2', 't4']);
});

test('non-agent bridges retain ancestry; missing and unrelated non-agent ancestors retain agent roots', () => {
  const h = harness([agent('t1'), agent('t3'), agent('t4'), agent('t6')], [terminal('t1'),
    terminal('t2', 't1', { program: { agent: false }, status: null }), terminal('t3', 't2'),
    terminal('t4', 'missing'), terminal('t5', null, { program: { agent: false }, status: null }), terminal('t6', 't5')]);
  assert.deepEqual(h.render().rows, ['ag-t1', 'sub-t2', 'sub-t3', 'ag-t4', 'ag-t6']);
});

test('owned unadopted orphans survive; unrelated and invalid-owner terminals are excluded', () => {
  const h = harness([], [terminal('t1', 'missing', { labels: { 'herdr.space': 's1', 'herdr.tab': 'tab1' } }),
    terminal('t2', 'missing'), terminal('t3', 'missing', { labels: { 'herdr.space': 'other', 'herdr.tab': 'tab1' } }),
    terminal('t4', null, { program: { agent: false }, status: null, labels: { 'herdr.space': 's1', 'herdr.tab': 'tab1' } })]);
  const r = h.render();
  assert.deepEqual(r.rows, ['ag-t1']);
  assert.deepEqual(r.navigation, []);
  r.click('ag-t1');
  assert.deepEqual(h.commands, [['terminal.peek', { terminal: 't1' }]]);
});

test('cross-tab children stay nested without changing explicit ownership', () => {
  const h = harness([agent('t1'), agent('t2', { tab: 'tab2' })], [terminal('t1'),
    terminal('t2', 't1', { labels: { 'herdr.space': 's1', 'herdr.tab': 'tab2' } })], { sort: 'grouped' });
  assert.deepEqual(h.render().rows, ['ag-t1', 'sub-t2']);
  assert.equal(h.input.list[1].tab, 'tab2');
  assert.equal(h.input.terminals[1].labels['herdr.tab'], 'tab2');
});

test('machine-qualified IDs do not collide and remote ownership labels are local IDs', () => {
  const h = harness([agent('t1'), agent('vps/t1', { space: 'vps/s1', space_name: 'remote', tab: 'vps/tab1' })],
    [terminal('t1'), terminal('t2', 't1'), terminal('vps/t1'), terminal('vps/t2', 'vps/t1'),
      terminal('vps/t3', 'vps/missing', { labels: { 'herdr.space': 's1', 'herdr.tab': 'tab1' } }),
      terminal('other/t3', 'other/missing', { labels: { 'herdr.space': 's1', 'herdr.tab': 'tab1' } })],
    { spaces: [space(), space('vps/s1', 'vps')] });
  assert.deepEqual(h.render().rows, ['ag-t1', 'sub-t2', 'ag-vps/t1', 'sub-vps/t2', 'ag-vps/t3']);
});

test('a pinned child promotes its tree without becoming a duplicate independent row', () => {
  const h = harness([agent('t0'), agent('t1'), agent('t2', { pinned: true })], [terminal('t0'), terminal('t1'), terminal('t2', 't1')]);
  const r = h.render();
  assert.deepEqual(r.rows, ['ag-t1', 'sub-t2', 'ag-t0']);
  assert.deepEqual(r.navigation, ['t1', 't2', 't0']);
  assert(r.nodes.some(node => node.id === 'pinned'));
});

test('root and group fold callbacks retain unique supported navigation', () => {
  const h = harness([agent('t1'), agent('t2')], [terminal('t1'), terminal('t2', 't1')]);
  h.render().click('fold-t1');
  let r = h.render();
  assert.deepEqual(r.rows, ['ag-t1']);
  assert.deepEqual(r.navigation, ['t1', 't2']);
  r.click('fold-t1');
  h.render().click('sec-2');
  r = h.render();
  assert.deepEqual(r.rows, []);
  assert.deepEqual(r.navigation, ['t1', 't2']);
});

test('parent removal preserves previously associated unadopted descendants without importing strangers', () => {
  const h = harness([agent('t1')], [terminal('t1'), terminal('t2', 't1'), terminal('t3', 't2'), terminal('t4', 'missing')]);
  assert.deepEqual(h.render().rows, ['ag-t1', 'sub-t2', 'sub-t3']);
  h.input.list = [];
  h.input.terminals = [terminal('t2', 't1'), terminal('t3', 't2'), terminal('t4', 'missing')];
  assert.deepEqual(h.render().rows, ['ag-t2', 'sub-t3']);
});

test('a finished non-agent bridge does not hide its live descendant', () => {
  const h = harness([agent('t1'), agent('t3')], [terminal('t1'), terminal('t2', 't1', { state: 'finished', program: {}, status: null }), terminal('t3', 't2')]);
  assert.deepEqual(h.render().rows, ['ag-t1', 'sub-t3']);
});

test('cycles and self-parent records terminate and render each address once', () => {
  const h = harness([agent('t1'), agent('t2'), agent('t3')], [terminal('t1', 't2'), terminal('t2', 't1'), terminal('t3', 't3')]);
  const r = h.render();
  assert.deepEqual(r.rows, ['ag-t1', 'sub-t2', 'ag-t3']);
  assert.deepEqual(r.navigation, ['t1', 't2', 't3']);
});

test('duplicate snapshots do not duplicate rows or navigation', () => {
  const h = harness([agent('t1'), agent('t1'), agent('t2')], [terminal('t1'), terminal('t2', 't1'), terminal('t2', 't1')]);
  assert.deepEqual(h.render().rows, ['ag-t1', 'sub-t2']);
});

test('descendant error retains urgency ordering and done children remain idle', () => {
  const h = harness([agent('t0', { status: 'working' }), agent('t1', { status: 'idle' })],
    [terminal('t0'), terminal('t1', null, { status: 'idle' }), terminal('t2', 't1', { status: 'error' })]);
  let r = h.render();
  assert.deepEqual(r.rows, ['ag-t1', 'sub-t2', 'ag-t0']);
  assert(r.nodes.some(node => node.id === 'sec-4'));
  h.input.terminals[2].status = 'done';
  r = h.render();
  assert.deepEqual(r.rows, ['ag-t0', 'ag-t1', 'sub-t2']);
});

test('rail hides descendants without making adopted children independent roots', () => {
  const h = harness([agent('t1'), agent('t2')], [terminal('t1'), terminal('t2', 't1')], { collapsed: true });
  const r = h.render();
  assert.deepEqual(r.rows, ['ag-t1']);
  assert.deepEqual(r.navigation, ['t1', 't2']);
});

test('existing focus, peek, pin, popup callbacks and row styling remain available', () => {
  const h = harness([agent('t1'), agent('t2')], [terminal('t1'), terminal('t2', 't1')]);
  let r = h.render();
  r.click('ag-t1');
  r.click('sub-t2');
  r.click('ag-sort');
  const root = r.nodes.find(node => node.id === 'ag-t1');
  assert(root.styles.some(([name, value]) => name === 'h' && value === 30));
  root.events.on_hover(true, { notify() {} });
  r = h.render();
  r.click('pin-t1');
  assert.deepEqual(h.commands, [['pane.focus', { pane: 'pane-t1' }], ['terminal.peek', { terminal: 't2' }], ['terminal.pin', { terminal: 't1', pinned: true }]]);
  assert.equal(h.overlays[0].mod, 'personal-agents');
  assert.equal(h.overlays[0].props.sortMenu, true);
});

function indicator(rendered, id) {
  const row = rendered.nodes.find(node => node.id === id);
  assert(row, `missing ${id}`);
  const nodes = [], text = [];
  function walk(node) {
    nodes.push(node);
    for (const child of node.children) {
      if (typeof child === 'string') text.push(child);
      else if (child?._node) walk(child._node);
    }
  }
  walk(row);
  return {
    working: nodes.some(node => node.styles.some(([name]) => name === 'spin')),
    blocked: text.includes('Needs you') || text.includes('!'),
  };
}

test('waiting or done parents show working descendants in full, grouped, pinned, folded and rail views', () => {
  for (const status of ['idle', 'done']) {
    for (const options of [{}, { sort: 'grouped' }, { collapsed: true }, { pinned: true }, { folded: true }]) {
      const h = harness([agent('t1', { status, pinned: !!options.pinned }), agent('t2')],
        [terminal('t1', null, { status }), terminal('t2', 't1')], options);
      if (options.folded) h.view.folded.add('t1');
      const r = h.render();
      assert.equal(indicator(r, 'ag-t1').working, true, JSON.stringify({ status, options }));
      if (!options.sort && !options.pinned && !options.collapsed) assert(r.nodes.some(n => n.id === 'sec-2'));
      assert.deepEqual(r.navigation, ['t1', 't2']);
    }
  }
});

test('nested activity propagates through waiting parents and clears on completion, exit or removal', () => {
  const h = harness([agent('t0', { status: 'idle' }), agent('t1', { status: 'idle' }), agent('t2', { status: 'idle' })],
    [terminal('t0', null, { status: 'idle' }), terminal('t1', null, { status: 'idle' }),
      terminal('t2', 't1', { status: 'idle' }), terminal('t3', 't2')]);
  let r = h.render();
  assert.equal(indicator(r, 'ag-t1').working, true);
  assert.equal(indicator(r, 'sub-t2').working, true);
  assert.equal(indicator(r, 'ag-t0').working, false);
  h.input.terminals[3].status = 'done';
  r = h.render();
  assert.equal(indicator(r, 'ag-t1').working, false);
  assert.equal(indicator(r, 'sub-t2').working, false);
  h.input.terminals[3].status = 'working';
  assert.equal(indicator(h.render(), 'ag-t1').working, true);
  h.input.terminals[3].state = 'finished';
  assert.equal(indicator(h.render(), 'ag-t1').working, false);
  h.input.terminals[3].state = 'live';
  assert.equal(indicator(h.render(), 'ag-t1').working, true);
  h.input.terminals.pop();
  assert.equal(indicator(h.render(), 'ag-t1').working, false);
});

test('own or descendant attention takes priority over inherited activity', () => {
  for (const own of ['blocked', 'idle', 'done']) {
    const h = harness([agent('t1', { status: own })], [terminal('t1', null, { status: own }),
      terminal('t2', 't1', { status: 'idle' }), terminal('t3', 't2', { status: 'error' }), terminal('t4', 't1')]);
    const r = h.render();
    assert.deepEqual(indicator(r, 'ag-t1'), { working: false, blocked: true });
    assert.deepEqual(indicator(r, 'sub-t2'), { working: false, blocked: true });
    assert(r.nodes.some(n => n.id === 'sec-4'));
  }
  const h = harness([agent('t1', { status: 'blocked' })], [terminal('t1'), terminal('t2', 't1')]);
  assert.deepEqual(indicator(h.render(), 'ag-t1'), { working: false, blocked: true });
});

test('inherited work clears a held Done placement without modifying the native status', () => {
  const h = harness([agent('t1', { status: 'done', focused: true })],
    [terminal('t1'), terminal('t2', 't1', { status: 'idle' })]);
  assert(h.render().nodes.some(n => n.id === 'sec-3'));
  h.input.list[0].status = 'idle';
  h.input.terminals[1].status = 'working';
  const r = h.render();
  assert.equal(indicator(r, 'ag-t1').working, true);
  assert(r.nodes.some(n => n.id === 'sec-2'));
  assert.equal(h.input.list[0].status, 'idle');
  h.input.terminals[1].status = 'done';
  assert(h.render().nodes.some(n => n.id === 'sec-1'));
});

test('folded space header reflects descendant work and returns to idle', () => {
  const h = harness([agent('t1', { status: 'idle' })],
    [terminal('t1'), terminal('t2', 't1')], { sort: 'grouped' });
  h.view.folded.add('sp-s1');
  assert.equal(indicator(h.render(), 'sp-s1').working, true);
  h.input.terminals[1].status = 'done';
  assert.equal(indicator(h.render(), 'sp-s1').working, false);
});

test('qualified ancestry and cycle protection also govern inherited activity', () => {
  const h = harness([agent('t1', { status: 'idle' }), agent('vps/t1', { status: 'idle' })],
    [terminal('t1', null, { status: 'idle' }), terminal('vps/t1', 'vps/t2', { status: 'idle' }), terminal('vps/t2', 'vps/t1')]);
  const r = h.render();
  assert.equal(indicator(r, 'ag-t1').working, false);
  assert.equal(indicator(r, 'ag-vps/t1').working, true);
});
