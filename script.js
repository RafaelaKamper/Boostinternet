document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registrationForm');
  const msg = document.getElementById('message');

  function showMessage(text, type = 'success') {
    msg.textContent = text;
    msg.className = type === 'success' ? 'success' : 'error';
  }

  async function saveRegistration(data) {
    try {
      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        console.error('Server antwortete mit Status', res.status);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Fehler beim Senden:', error);
      return false;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';

    const formData = new FormData(form);
    const entry = {
      vorname: (formData.get('vorname') || '').toString().trim(),
      nachname: (formData.get('nachname') || '').toString().trim(),
      schule: (formData.get('schule') || '').toString().trim(),
      schulform: (formData.get('schulform') || '').toString(),
      klasse: (formData.get('klasse') || '').toString().trim()
    };

    if (!entry.vorname || !entry.nachname || !entry.schule || !entry.schulform || !entry.klasse) {
      showMessage('Bitte alle Felder ausfüllen.', 'error');
      return;
    }
    if (!['GYM', 'NMS'].includes(entry.schulform)) {
      showMessage('Ungültige Schulform. Bitte GYM oder NMS wählen.', 'error');
      return;
    }

    const saved = await saveRegistration(entry);
    if (saved) {
      showMessage('Anmeldung erfolgreich. Du wirst weitergeleitet...');
      form.reset();
      setTimeout(() => {
        window.location.href = '/home.html';
      }, 800);
    } else {
      showMessage('Fehler beim Speichern.', 'error');
    }
  });
});