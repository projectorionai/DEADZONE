/* Grid inventory with stacking, weight limit, and drag/drop support.
 * Slots are a flat array of length cols*rows. Each slot is null or {id, qty}.
 * Weapons (stack=1) occupy one slot each.
 */
class Inventory {
  constructor(cols, rows, getMaxWeight) {
    this.cols = cols;
    this.rows = rows;
    this.slots = new Array(cols * rows).fill(null);
    this.getMaxWeight = getMaxWeight || (() => 999);
  }

  get size() { return this.slots.length; }

  clear() { this.slots.fill(null); }

  weight() {
    let w = 0;
    // Standard for-loop is marginally faster than for...of for dense arrays
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s) w += ITEMS[s.id].weight * s.qty;
    }
    return Math.round(w * 10) / 10;
  }

  maxWeight() { return this.getMaxWeight(); }
  
  isOverweight() { return this.weight() > this.maxWeight(); }

  count(id) {
    let n = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && s.id === id) n += s.qty;
    }
    return n;
  }

  firstEmpty() {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i] === null) return i;
    }
    return -1;
  }

  // Add items; returns quantity that could NOT be added (0 = all fit).
  add(id, qty, data = null) {
    const item = ITEMS[id];
    if (!item) return qty;

    let remaining = qty;

    // Pass 1: Attempt to fill existing partial stacks
    if (item.stack > 1) {
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.qty < item.stack) {
          const space = item.stack - s.qty;
          const put = Math.min(space, remaining);
          s.qty += put;
          remaining -= put;
        }
      }
    }

    // Pass 2: Place remaining items into empty slots
    // Optimisation: Continuous linear scan rather than repeatedly calling firstEmpty()
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i] === null) {
        const put = Math.min(item.stack, remaining);
        this.slots[i] = { id, qty: put, ...(data && { data }) };
        remaining -= put;
      }
    }

    return remaining;
  }

  // Remove up to qty of id; returns amount actually removed.
  remove(id, qty) {
    let toRemove = qty;
    for (let i = 0; i < this.slots.length && toRemove > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.qty, toRemove);
        s.qty -= take;
        toRemove -= take;
        if (s.qty <= 0) this.slots[i] = null;
      }
    }
    return qty - toRemove;
  }

  removeSlot(index, qty) {
    const s = this.slots[index];
    if (!s) return 0;
    const take = Math.min(s.qty, qty);
    s.qty -= take;
    if (s.qty <= 0) this.slots[index] = null;
    return take;
  }

  // Drag/drop: move or merge slot a -> slot b.
  moveSlot(a, b) {
    if (a === b) return;
    const sa = this.slots[a];
    const sb = this.slots[b];

    if (!sa) return;

    if (!sb) { 
      this.slots[b] = sa; 
      this.slots[a] = null; 
      return; 
    }

    if (sb.id === sa.id) {
      const stack = ITEMS[sa.id].stack;
      const space = stack - sb.qty;
      const move = Math.min(space, sa.qty);
      sb.qty += move;
      sa.qty -= move;
      if (sa.qty <= 0) this.slots[a] = null;
    } else {
      // Swap items
      this.slots[a] = sb;
      this.slots[b] = sa;
    }
  }

  // Optimisation: Mathematical capacity verification (replaces deep cloning)
  hasSpaceFor(id, qty) {
    const item = ITEMS[id];
    if (!item) return false;

    let availableSpace = 0;

    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      
      if (s === null) {
        availableSpace += item.stack;
      } else if (s.id === id && s.qty < item.stack) {
        availableSpace += (item.stack - s.qty);
      }

      // Early exit condition prevents unnecessary iterations
      if (availableSpace >= qty) return true;
    }

    return false;
  }

  serialize() { 
    return this.slots.map(s => (s ? { id: s.id, qty: s.qty } : null)); 
  }

  load(data) {
    if (!Array.isArray(data)) return;
    this.clear(); // Ensure state is reset before populating
    const limit = Math.min(data.length, this.slots.length);
    for (let i = 0; i < limit; i++) {
      const s = data[i];
      if (s && ITEMS[s.id]) {
        this.slots[i] = { id: s.id, qty: s.qty };
      }
    }
  }
}