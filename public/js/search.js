export function searchPastors(pastors, query) {
  if (!query.trim()) return pastors;
  const q = query.toLowerCase();
  return pastors.filter(p => {
    const addr = p.address;
    const addrStr = addr ? `${addr.street} ${addr.city} ${addr.state} ${addr.zip}`.toLowerCase() : '';
    const phones = (p.phones || []).map(ph => ph.number).join(' ');
    const churches = (p.churches || []).join(' ').toLowerCase();
    const searchStr = [
      p.displayName,
      p.firstName,
      p.lastName,
      p.email || '',
      phones,
      addrStr,
      churches,
    ].join(' ').toLowerCase();
    return searchStr.includes(q);
  });
}

export function searchChurches(churches, query) {
  if (!query.trim()) return churches;
  const q = query.toLowerCase();
  return churches.filter(c => {
    const pastorNames = c.pastors.map(p => p.displayName).join(' ').toLowerCase();
    return c.name.toLowerCase().includes(q) || pastorNames.includes(q);
  });
}
