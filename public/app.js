(() => {
  const form = document.getElementById('entry-form');
  const nameInput = document.getElementById('name');
  const messageInput = document.getElementById('message');
  const nameCounter = document.getElementById('name-counter');
  const messageCounter = document.getElementById('message-counter');
  const errorEl = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  const list = document.getElementById('entry-list');
  const emptyEl = document.getElementById('empty');

  const MAX_NAME = 20;
  const MAX_MESSAGE = 500;
  const charLen = (s) => [...s].length;

  const dateFormat = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  function updateCounters() {
    nameCounter.textContent = `${charLen(nameInput.value)} / ${MAX_NAME}`;
    messageCounter.textContent = `${charLen(messageInput.value)} / ${MAX_MESSAGE}`;
  }

  // NFR-02: innerHTML을 쓰지 않고 textContent로만 삽입 → HTML/스크립트가 텍스트로 표시됨
  function createEntryElement(entry) {
    const li = document.createElement('li');
    li.className = 'entry';

    const head = document.createElement('div');
    head.className = 'entry-head';

    const name = document.createElement('span');
    name.className = 'entry-name';
    name.textContent = entry.name;

    const time = document.createElement('time');
    time.className = 'entry-date';
    time.dateTime = entry.createdAt;
    time.textContent = dateFormat.format(new Date(entry.createdAt));

    const msg = document.createElement('p');
    msg.className = 'entry-message';
    msg.textContent = entry.message;

    head.append(name, time);
    li.append(head, msg);
    return li;
  }

  function render(entries) {
    list.replaceChildren(...entries.map(createEntryElement));
    emptyEl.hidden = entries.length > 0; // FR-10
  }

  async function loadEntries() {
    try {
      const res = await fetch('/api/entries');
      if (!res.ok) throw new Error();
      render(await res.json());
    } catch {
      emptyEl.hidden = true;
      errorEl.textContent = '목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    // FR-04: 빈 값 안내
    if (!name && !message) {
      errorEl.textContent = '이름과 메시지를 입력해 주세요.';
      nameInput.focus();
      return;
    }
    if (!name) {
      errorEl.textContent = '이름을 입력해 주세요.';
      nameInput.focus();
      return;
    }
    if (!message) {
      errorEl.textContent = '메시지를 입력해 주세요.';
      messageInput.focus();
      return;
    }
    if (charLen(name) > MAX_NAME || charLen(message) > MAX_MESSAGE) {
      errorEl.textContent = `이름은 ${MAX_NAME}자, 메시지는 ${MAX_MESSAGE}자 이내로 입력해 주세요.`;
      return;
    }

    submitBtn.disabled = true;
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorEl.textContent = data.error || '등록에 실패했습니다.';
        return;
      }
      // FR-05: 입력란 초기화
      form.reset();
      updateCounters();
      // NFR-03: 응답 즉시 목록 맨 위에 반영
      list.prepend(createEntryElement(data));
      emptyEl.hidden = true;
    } catch {
      errorEl.textContent = '네트워크 오류로 등록하지 못했습니다.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  nameInput.addEventListener('input', updateCounters);
  messageInput.addEventListener('input', updateCounters);

  updateCounters();
  loadEntries();
})();
