export function generateVCard(pastor) {
  const addr = pastor.address || {};
  // Convert "Mon DD" birthday to YYYYMMDD — year unknown, use 0000
  let bday = '';
  if (pastor.birthday) {
    const months = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                     Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    const parts = pastor.birthday.split(' ');
    if (parts.length === 2) {
      const mon = months[parts[0]] || '01';
      const day = parts[1].padStart(2, '0');
      bday = `BDAY:0000-${mon}-${day}`;
    }
  }

  const phone = pastor.primaryPhone
    ? `TEL;TYPE=CELL:+1${pastor.primaryPhone}`
    : '';

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${pastor.lastName};${pastor.firstName};;;`,
    `FN:${pastor.displayName}`,
    'ORG:Carolina Conference SDA',
    phone,
    pastor.email ? `EMAIL:${pastor.email}` : '',
    addr.street ? `ADR;TYPE=HOME:;;${addr.street};${addr.city};${addr.state};${addr.zip};USA` : '',
    bday,
    'END:VCARD',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([lines], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pastor.displayName.replace(/\s+/g, '_')}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
