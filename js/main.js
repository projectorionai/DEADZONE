/* Boot: create the game, wire resize, class picker, and start screen. */
(function () {
  function boot() {
    const canvas = document.getElementById('game');
    const game = new Game(canvas);
    window.DZ = game;

    window.addEventListener('resize', () => game.resize());

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && game.gameStarted) game.lastTime = performance.now();
    });

    const startBtn = document.getElementById('startBtn');
    const wipeBtn = document.getElementById('wipeBtn');
    const startScreen = document.getElementById('startScreen');
    const classGrid = document.getElementById('classGrid');
    const classDetail = document.getElementById('classDetail');
    const classPicker = document.getElementById('classPicker');
    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) usernameInput.value = localStorage.getItem(Game.USERNAME_KEY) || '';

    let pickedClass = game.selectedClass;

    function renderClassDetail(id) {
      const c = getClass(id);
      classDetail.innerHTML =
        `<h3 style="color:${c.color}">${c.name}</h3>` +
        `<p>${c.blurb}</p>` +
        `<div class="pros"><b>Pros:</b> ${c.pros.join(' · ')}</div>` +
        `<div class="cons"><b>Cons:</b> ${c.cons.join(' · ')}</div>`;
    }

    function selectClass(id) {
      pickedClass = id;
      game.selectedClass = id;
      document.querySelectorAll('.class-card').forEach(el => {
        el.classList.toggle('selected', el.dataset.class === id);
      });
      renderClassDetail(id);
      if (startBtn) startBtn.disabled = false;
    }

    if (classGrid) {
      for (const c of Object.values(CLASSES)) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'class-card';
        card.dataset.class = c.id;
        card.innerHTML = `<span class="dot" style="background:${c.color}"></span>${c.name}`;
        card.addEventListener('click', () => selectClass(c.id));
        classGrid.appendChild(card);
      }
      selectClass(pickedClass);
    }

    if (SaveSystem.hasSave()) {
      if (classPicker) classPicker.classList.add('hidden');
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = 'Continue';
      }
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (usernameInput) game.setUsername(usernameInput.value);
        startScreen.classList.add('hidden');
        if (!game.gameStarted) {
          if (SaveSystem.hasSave()) {
            game.gameStarted = true;
          } else {
            // Fresh survivor: play the outbreak intro, then drop them in.
            game.ui.playIntro(() => game.startNewGame(pickedClass));
          }
        }
      });
    }

    if (wipeBtn) {
      wipeBtn.addEventListener('click', () => {
        if (confirm('Delete your saved game and start over?')) game.hardReset();
      });
    }

    const respawnBtn = document.getElementById('respawnBtn');
    if (respawnBtn) respawnBtn.addEventListener('click', () => game.respawn());

    game.start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
