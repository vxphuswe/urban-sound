// Bộ icon nét (24×24, stroke = currentColor) tự vẽ cho dự án + minh họa lớn cho kết quả nhận diện.

const P = {
  // ---------- giao diện
  logo: '<path d="M7 9.5a5 5 0 0 1 10 0c0 2.2-1.3 3.3-2.4 4.2-.9.7-1.6 1.3-1.6 2.6a2.5 2.5 0 0 1-5 .2"/><path d="M10 9.6a2 2 0 0 1 4 0"/><path d="M19.5 6.5a9 9 0 0 1 0 7M4.5 6.5a9 9 0 0 0 0 7" opacity=".55"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  cam: '<rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>',
  camOff: '<path d="M10 6.5h3.5A2.5 2.5 0 0 1 16 9v3.5m0 2.5V15a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 15V9a2.5 2.5 0 0 1 2-2.4"/><path d="m16 10.5 5-3v9l-3.5-2.1M3 3l18 18"/>',
  flip: '<path d="M4 9.5V8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v1.5"/><path d="M20 14.5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5"/><path d="m7 12.5 2-2 2 2M17 11.5l-2 2-2-2M9 10.5v2.5M15 13.5V11"/>',
  record: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
  snap: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
  micOff: '<path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.8 2.4"/><path d="M18.5 11a6.4 6.4 0 0 1-.9 3.3M5.5 11a6.5 6.5 0 0 0 10.3 5.3M12 17.5V21M8.5 21h7M3 3l18 18"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 14v3.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V14"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13v3M12 11v7M15 13.5v2"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9.2 5 2.8-5 2.8z"/>',
  play: '<path d="M7 4.8v14.4a1 1 0 0 0 1.5.9l11.3-7.2a1 1 0 0 0 0-1.8L8.5 3.9A1 1 0 0 0 7 4.8z"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/>',
  stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M8 7.5h8M8 11h5"/>',
  bars: '<path d="M4 20V10M9.3 20V4M14.6 20v-7M20 20v-4"/>',
  heart: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16.5 14.5 12 10 7.5M14.5 12H4"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 4v4.5H8M12 7.5V12l3 2"/>',
  alert: '<path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h0"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  gauge: '<path d="M4.2 17.5A9 9 0 1 1 19.8 17.5"/><path d="m12 14 4-5"/><circle cx="12" cy="14" r="1.6"/>',
  sparkles: '<path d="M12 3.5 13.6 8 18 9.6l-4.4 1.6L12 15.6l-1.6-4.4L6 9.6 10.4 8z"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7zM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6z"/>',
  text: '<path d="M4 6h16M4 10h11M4 14h16M4 18h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  ear: '<path d="M7 9.5a5 5 0 0 1 10 0c0 2.2-1.3 3.3-2.4 4.2-.9.7-1.6 1.3-1.6 2.6a2.5 2.5 0 0 1-5 .2"/><path d="M10 9.6a2 2 0 0 1 4 0"/>',
  bellAlert: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  vol0: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>',
  vol1: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>',
  vol2: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>',
  vol3: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10M20.5 4.5a10.5 10.5 0 0 1 0 15"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  github: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',

  // ---------- nhóm âm thanh
  dog: '<path d="M5 9.5 3.5 5.5 7.5 7"/><path d="M19 9.5l1.5-4L16.5 7"/><path d="M6 8.5c1.2-1.5 3.4-2.5 6-2.5s4.8 1 6 2.5c.9 1.2 1 3 .5 4.7-.8 2.9-3.4 5.3-6.5 5.3s-5.7-2.4-6.5-5.3c-.5-1.7-.4-3.5.5-4.7z"/><circle cx="9.5" cy="11" r=".9" fill="currentColor"/><circle cx="14.5" cy="11" r=".9" fill="currentColor"/><path d="M11 14h2l-1 1.2zM12 15.2v1"/>',
  cat: '<path d="M5 11V4l4 3.5h6L19 4v7"/><path d="M5 11c0 4.4 3.1 8 7 8s7-3.6 7-8"/><circle cx="9.5" cy="12" r=".9" fill="currentColor"/><circle cx="14.5" cy="12" r=".9" fill="currentColor"/><path d="M11.2 14.5h1.6l-.8.9zM3 14l4 .5M3 16.5l4-.5M21 14l-4 .5M21 16.5l-4-.5"/>',
  rooster: '<path d="M9 5.5c0-1.5 1-2.5 2-2.5.3 1 1.2 1.2 2 1"/><path d="M8 6.5a4 4 0 0 1 6.5 3l4.5-2.5c1 3.5.5 7-2 9.5H9.5A5.5 5.5 0 0 1 6 9.5L3.5 9 6 7.5"/><path d="M10.5 16.5V21M14 16.5V21M9 21h3M12.5 21h3"/><circle cx="9.5" cy="8" r=".8" fill="currentColor"/>',
  cow: '<path d="M4 6.5 7 8M20 6.5 17 8"/><path d="M7 7.5h10l.5 5.5a5.5 5.5 0 0 1-11 0z"/><ellipse cx="12" cy="15.5" rx="4" ry="2.8"/><circle cx="10.5" cy="15.5" r=".6" fill="currentColor"/><circle cx="13.5" cy="15.5" r=".6" fill="currentColor"/><circle cx="9.5" cy="10.5" r=".8" fill="currentColor"/><circle cx="14.5" cy="10.5" r=".8" fill="currentColor"/>',
  bird: '<path d="M16 7.5a3.5 3.5 0 0 0-6.7-1.3L4 13c2 .5 4 .3 5.5-.5-.3 3 1.8 6 5.5 6.5 3-2.3 3.4-6.2 1-9.5z"/><path d="M16 7.5 19.5 8 16.5 10"/><circle cx="13.6" cy="7.2" r=".8" fill="currentColor"/><path d="M11 19l-1 2.5M14 19.5l.5 2"/>',
  bug: '<ellipse cx="12" cy="13.5" rx="4.5" ry="6"/><path d="M12 7.5v12M9 5.5 7.5 3M15 5.5 16.5 3M7.5 11H4M7.5 15.5H4.5M16.5 11H20M16.5 15.5h3"/>',
  paw: '<ellipse cx="12" cy="15.5" rx="4" ry="3.5"/><circle cx="6.5" cy="10.5" r="1.8"/><circle cx="17.5" cy="10.5" r="1.8"/><circle cx="9.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/>',
  children: '<circle cx="7.5" cy="6" r="2.3"/><circle cx="16.5" cy="7.5" r="2"/><path d="M7.5 8.5v6M7.5 10.5l-3-2M7.5 10.5l3.5-1M7.5 14.5 5 20M7.5 14.5l2.5 5.5M16.5 9.5v5M16.5 11l-3 1.5M16.5 11l3-2M16.5 14.5l-2 5M16.5 14.5l2 5"/>',
  baby: '<circle cx="12" cy="11" r="6.5"/><path d="M12 4.5c-1 1.5-.5 2.5.8 2.5"/><path d="M9 10h.01M15 10h.01M10 14.2a2.8 2.8 0 0 0 4 0"/><path d="M5.5 11H4M20 11h-1.5"/>',
  speech: '<path d="M4 5.5h16v10H11l-4.5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  crowd: '<circle cx="12" cy="7" r="2.5"/><circle cx="5.5" cy="9" r="2"/><circle cx="18.5" cy="9" r="2"/><path d="M7.5 20v-2.5a4.5 4.5 0 0 1 9 0V20M2.5 18.5V17a3 3 0 0 1 4-2.8M21.5 18.5V17a3 3 0 0 0-4-2.8"/>',
  laugh: '<circle cx="12" cy="12" r="8.5"/><path d="M8 13.5h8a4 4 0 0 1-8 0zM8 9.5l1.5-1 1.5 1M13 9.5l1.5-1 1.5 1"/>',
  shout: '<circle cx="9" cy="11" r="6"/><ellipse cx="9" cy="13" rx="2" ry="2.5"/><path d="M7 8.5h.01M11 8.5h.01M17 7l3-2M17.5 11h3.5M17 15l3 2"/>',
  cough: '<circle cx="9" cy="12" r="6.5"/><path d="M7 10h.01M11 10h.01M7.5 14.5h3"/><path d="M17.5 10.5c1 0 1.5.6 1.5 1.5s-.5 1.5-1.5 1.5M19.5 8.5c1.5 0 2 .9 2 1.8M19.5 15.5c1.5 0 2-.9 2-1.8"/>',
  steps: '<path d="M7 3.5c1.7 0 2.5 2 2.5 4.5S8.5 12 7 12 4.5 10.5 4.5 8 5.3 3.5 7 3.5zM5 14.5h4M17 8c1.7 0 2.5 2 2.5 4.5S18.5 16.5 17 16.5s-2.5-1.5-2.5-4S15.3 8 17 8zM15 19h4"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/><path d="M9 9.5l11-2"/>',
  motorbike: '<circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M8.5 16.5h5l3-6h-4l-2 3H7.5M14.5 6.5H17l1.5 4"/><path d="M10 10.5h3"/>',
  horn: '<path d="M3.5 10v4h3l7 4.5v-13l-7 4.5z"/><path d="M17 8.5l3-2M17.5 12H21M17 15.5l3 2"/>',
  car: '<path d="M3.5 16.5v-4l2-5a2 2 0 0 1 1.9-1.3h9.2a2 2 0 0 1 1.9 1.3l2 5v4z"/><path d="M3.5 12.5h17"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
  siren: '<path d="M6 18v-5.5a6 6 0 0 1 12 0V18"/><path d="M4 18h16v2.5H4zM12 3v2M4.5 5.5 6 7M19.5 5.5 18 7M10 12.5a2 2 0 0 1 2-2"/>',
  train: '<rect x="5.5" y="3.5" width="13" height="13" rx="3"/><path d="M5.5 10h13M9 13.5h.01M15 13.5h.01M8 16.5 6 20.5M16 16.5l2 4M7 19h10"/>',
  plane: '<path d="M10.5 20.5 12 15l-6.5 1.5L4 15l7.5-3.5V5a1.5 1.5 0 0 1 3 0v6.5L22 15l-1.5 1.5L14 15l1.5 5.5z"/>',
  boat: '<path d="M3 15.5h18l-2.5 4h-13z"/><path d="M12 3.5v12M12 4.5l6 9H12M12 6.5l-4.5 7H12"/>',
  engine: '<rect x="5" y="8.5" width="11" height="9" rx="1.5"/><path d="M8 8.5V6h5v2.5M16 11h2.5v2H21v4h-2.5v-2H16M5 12H3v3h2M8 12h5"/>',
  boom: '<path d="m12 2.5 2 5.5 5-3-1.8 5.5 5.3 1.5-5 2.5 2.5 5-5.5-1.5-1.5 5.5-2-5-5 2.5 1.8-5.5-5.3-1.5 5-2.5L5.3 4.8l5.5 1.7z"/>',
  fireworks: '<path d="M12 12V21M12 12l-4.5-4.5M12 12l4.5-4.5M12 12V5M12 12H5.5M12 12h6.5M12 12l-3.5 4M12 12l3.5 4"/><circle cx="12" cy="3.5" r=".8" fill="currentColor"/><circle cx="6" cy="6" r=".8" fill="currentColor"/><circle cx="18" cy="6" r=".8" fill="currentColor"/>',
  alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 1.5M4 5.5 6.5 3M20 5.5 17.5 3M7 19.5l-1.5 2M17 19.5l1.5 2"/>',
  glass: '<path d="M7 3h10l-1 9a4 4 0 0 1-8 0z"/><path d="M12 16v5M9 21h6M11 3l1.5 4-2 2.5 1.5 3"/>',
  fire: '<path d="M12 21.5c-3.9 0-7-2.8-7-6.6C5 10 9.5 8.5 9.5 3.5c3 1.7 4.5 4.5 4.5 7 1-.5 1.7-1.6 1.8-2.8C18 9.5 19 12.3 19 14.9c0 3.8-3.1 6.6-7 6.6z"/><path d="M12 21.5c-1.7 0-3-1.3-3-3 0-2 2-3 2.5-5 1.8 1 3.5 2.8 3.5 5 0 1.7-1.3 3-3 3z"/>',
  drill: '<path d="M3.5 7.5h11v5h-11z"/><path d="M14.5 9h4M18.5 10h2.5M8 12.5l-1.5 8H11l1-8M7 16h3.5"/>',
  fan: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10.2C12 6 13.5 3.5 16 3.5c2 0 2.5 2.5.5 4.5-1.4 1.4-3 2-4.5 2.2zM13.8 12c4.2 0 6.7 1.5 6.7 4 0 2-2.5 2.5-4.5.5-1.4-1.4-2-3-2.2-4.5zM12 13.8c0 4.2-1.5 6.7-4 6.7-2 0-2.5-2.5-.5-4.5 1.4-1.4 3-2 4.5-2.2zM10.2 12C6 12 3.5 10.5 3.5 8c0-2 2.5-2.5 4.5-.5 1.4 1.4 2 3 2.2 4.5z"/>',
  blender: '<path d="M7 3.5h10l-1.5 10h-7z"/><path d="M8.5 13.5h7l1 7h-9zM11 17h2M9.5 7.5h5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  door: '<path d="M5.5 21V4.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1V21M3.5 21h17"/><circle cx="15" cy="12.5" r=".9" fill="currentColor"/>',
  keyboard: '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"/>',
  tv: '<rect x="3" y="6.5" width="18" height="12" rx="2"/><path d="m8.5 2.5 3.5 4 3.5-4M8 21.5h8"/>',
  rain: '<path d="M7 15.5a4.5 4.5 0 0 1-.4-9 5.5 5.5 0 0 1 10.6 1.5A3.8 3.8 0 0 1 17 15.5z"/><path d="M8 18.5 7 21M12 18.5 11 21M16 18.5 15 21"/>',
  water: '<path d="M12 3.5c3 4 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 3-6.5 6-10.5z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>',
  wind: '<path d="M3 8.5h11.5a2.5 2.5 0 1 0-2.5-2.5M3 12.5h16a2.5 2.5 0 1 1-2.5 2.5M3 16.5h7.5a2 2 0 1 1-2 2"/>',
  noise: '<path d="M3 12h1.5l1.5-4 2 9 2-12 2 14 2-10 2 7 1.5-5 1.5 3H21"/>',
};

export function icon(name, { size = 20, cls = '', stroke = 1.8, title = '' } = {}) {
  const body = P[name] || P.wave;
  const t = title ? `<title>${title}</title>` : '';
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${title ? 'false' : 'true'}">${t}${body}</svg>`;
}

export const ICON_NAMES = Object.keys(P);

// Logo Google & Apple cho nút đăng nhập (màu thương hiệu, chỉ dùng trên nút đăng nhập)
export const BRAND = {
  google: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
  apple: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 5.6c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg>',
};

// ------------------------------------------------------------------ minh họa lớn cho thẻ kết quả
// Bé cún có đuôi vẫy và chữ "Gâu!" – hiện khi nhận diện được tiếng chó.
/** Logo Urban Sound: sóng âm phát ra từ dãy nhà phố (cũng là cột equalizer), cửa sổ vàng như đèn đường. */
export const LOGO_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="usLogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2ee6c5"/><stop offset="1" stop-color="#6b7bff"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#usLogo)"/><g fill="none" stroke="#08112b" stroke-width="2.6" stroke-linecap="round"><path d="M10.5 15.5a9.5 9.5 0 0 1 19 0"/><path d="M15 15.5a5 5 0 0 1 10 0" opacity=".6"/></g><circle cx="20" cy="15.5" r="1.9" fill="#08112b"/><g fill="#08112b"><rect x="8.4" y="25" width="3.6" height="7" rx="1.2"/><rect x="13.6" y="22" width="3.6" height="10" rx="1.2"/><rect x="18.2" y="19.5" width="3.6" height="12.5" rx="1.2"/><rect x="22.8" y="23" width="3.6" height="9" rx="1.2"/><rect x="28" y="26" width="3.6" height="6" rx="1.2"/></g><rect x="19.2" y="22.5" width="1.6" height="1.8" rx=".4" fill="#ffb547"/><rect x="14.6" y="25" width="1.6" height="1.8" rx=".4" fill="#ffb547"/></svg>`;

export const ILLUSTRATIONS = {
  dog: `<svg class="illo illo-dog" viewBox="0 0 220 200" role="img" aria-label="Minh họa chú chó">
  <ellipse cx="112" cy="186" rx="70" ry="8" class="illo-shadow"/>
  <g class="dog-tail"><path d="M160 128c18-4 26-20 22-34" stroke="#c98a4b" stroke-width="12" stroke-linecap="round" fill="none"/></g>
  <path d="M70 120c0-22 20-34 44-34s46 10 46 36v30c0 14-10 22-22 22H92c-12 0-22-8-22-22z" fill="#e0a466"/>
  <path d="M92 150c0 8 4 24 4 24h14l-2-24zM132 150c0 8 2 24 2 24h14l-4-24z" fill="#c98a4b"/>
  <path d="M96 128c4 10 32 10 36 0" fill="#f6dcb8"/>
  <g class="dog-head">
    <path d="M58 70c0-26 22-42 50-42s50 16 50 42-22 46-50 46-50-20-50-46z" fill="#e8b273"/>
    <path d="M60 44c-14 4-22 26-16 44 6 6 14 2 18-6 2-12 6-26-2-38z" fill="#9b6233" class="dog-ear-l"/>
    <path d="M156 44c14 4 22 26 16 44-6 6-14 2-18-6-2-12-6-26 2-38z" fill="#9b6233" class="dog-ear-r"/>
    <ellipse cx="108" cy="86" rx="28" ry="20" fill="#f6dcb8"/>
    <circle cx="88" cy="68" r="6" fill="#2b1d12"/><circle cx="128" cy="68" r="6" fill="#2b1d12"/>
    <circle cx="90" cy="66" r="2" fill="#fff"/><circle cx="130" cy="66" r="2" fill="#fff"/>
    <ellipse cx="108" cy="80" rx="8" ry="6" fill="#2b1d12"/>
    <path d="M98 92c4 6 16 6 20 0" stroke="#2b1d12" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M104 96c0 8 8 8 8 0z" fill="#ef6f7a" class="dog-tongue"/>
    <circle cx="76" cy="84" r="6" fill="#f29a8c" opacity=".55"/><circle cx="140" cy="84" r="6" fill="#f29a8c" opacity=".55"/>
  </g>
  <path d="M90 118h36" stroke="#d6453d" stroke-width="7" stroke-linecap="round"/>
  <circle cx="108" cy="124" r="5" fill="#f2c14e"/>
  <g class="bark-bubble"><path d="M168 18h40a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-26l-10 10v-10h-4a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8z" fill="#fff"/><text x="188" y="42" text-anchor="middle" font-size="15" font-weight="800" fill="#1d2b2a">Gâu!</text></g>
</svg>`,
  cat: `<svg class="illo illo-cat" viewBox="0 0 220 200" role="img" aria-label="Minh họa chú mèo">
  <ellipse cx="110" cy="186" rx="64" ry="8" class="illo-shadow"/>
  <g class="cat-tail"><path d="M150 160c30 0 40-30 26-50" stroke="#8a8f9e" stroke-width="11" stroke-linecap="round" fill="none"/></g>
  <path d="M70 130c0-20 18-32 40-32s40 12 40 32v28c0 12-8 20-20 20H90c-12 0-20-8-20-20z" fill="#a3a9b8"/>
  <g class="cat-head">
    <path d="M62 40l20 20h56l20-20 4 46c0 26-24 44-52 44S58 112 58 86z" fill="#b4b9c6"/>
    <path d="M68 50l12 12M152 50l-12 12" stroke="#f1b7c3" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="90" cy="84" rx="7" ry="9" fill="#2b2f3a"/><ellipse cx="130" cy="84" rx="7" ry="9" fill="#2b2f3a"/>
    <circle cx="92" cy="81" r="2.5" fill="#fff"/><circle cx="132" cy="81" r="2.5" fill="#fff"/>
    <path d="M104 98h12l-6 6z" fill="#e98ea0"/>
    <path d="M110 104c-2 6-10 6-12 2M110 104c2 6 10 6 12 2" stroke="#2b2f3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M70 96l-22-4M70 102l-22 4M150 96l22-4M150 102l22 4" stroke="#6f7484" stroke-width="2" stroke-linecap="round"/>
  </g>
  <g class="bark-bubble"><path d="M160 14h48a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-30l-10 10V50h-8a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z" fill="#fff"/><text x="184" y="38" text-anchor="middle" font-size="14" font-weight="800" fill="#1d2b2a">Meo~</text></g>
</svg>`,
  bird: `<svg class="illo illo-bird" viewBox="0 0 220 200" role="img" aria-label="Minh họa chú chim">
  <path d="M30 150h160" stroke="#8b6a45" stroke-width="8" stroke-linecap="round"/>
  <g class="bird-body"><path d="M70 110c0-30 22-52 50-52 20 0 34 14 34 32 0 30-26 52-56 52-16 0-28-14-28-32z" fill="#4fb3a6"/>
  <path d="M84 112c10 18 40 20 52 0-8 20-44 24-52 0z" fill="#f2d16b"/>
  <path d="M96 96c10-10 30-10 40 4-14-2-28 0-40-4z" fill="#3a8f84" class="bird-wing"/>
  <circle cx="132" cy="80" r="6" fill="#1d2b2a"/><circle cx="134" cy="78" r="2" fill="#fff"/>
  <path d="M152 84l18 6-18 6z" fill="#f29b38"/>
  <path d="M100 140v12M116 140v12" stroke="#f29b38" stroke-width="4" stroke-linecap="round"/></g>
  <g class="notes"><path d="M176 50v-20l14-4v20" stroke="#4fb3a6" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="172" cy="50" r="5" fill="#4fb3a6"/><circle cx="186" cy="46" r="5" fill="#4fb3a6"/></g>
</svg>`,
  children: `<svg class="illo illo-kids" viewBox="0 0 220 200" role="img" aria-label="Minh họa trẻ em vui chơi">
  <ellipse cx="110" cy="186" rx="80" ry="8" class="illo-shadow"/>
  <g class="kid kid-a"><circle cx="76" cy="62" r="20" fill="#f4c7a1"/><path d="M56 58c0-14 10-22 20-22s22 8 20 22c-6-6-14-8-20-8s-14 2-20 8z" fill="#3b2a20"/>
  <circle cx="70" cy="64" r="2.5" fill="#2b1d12"/><circle cx="84" cy="64" r="2.5" fill="#2b1d12"/><path d="M70 72c4 4 10 4 14 0" stroke="#2b1d12" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M60 86h32l6 50H54z" fill="#5b8def"/><path d="M60 92l-20-20M92 92l18-16" stroke="#f4c7a1" stroke-width="7" stroke-linecap="round"/>
  <path d="M64 136l-4 40M88 136l4 40" stroke="#2f3b55" stroke-width="8" stroke-linecap="round"/></g>
  <g class="kid kid-b"><circle cx="146" cy="74" r="18" fill="#f0bf95"/><path d="M128 72c0-14 8-20 18-20s20 6 18 20l-4-6c-6 2-20 2-28 6z" fill="#7a4a2b"/>
  <circle cx="140" cy="76" r="2.5" fill="#2b1d12"/><circle cx="152" cy="76" r="2.5" fill="#2b1d12"/><ellipse cx="146" cy="84" rx="4" ry="3" fill="#2b1d12"/>
  <path d="M130 96h32l8 46h-48z" fill="#f2a541"/><path d="M132 102l-16 18M160 102l20-18" stroke="#f0bf95" stroke-width="7" stroke-linecap="round"/>
  <path d="M136 142v34M156 142v34" stroke="#2f3b55" stroke-width="8" stroke-linecap="round"/></g>
  <circle class="ball" cx="188" cy="60" r="12" fill="#ef5d68"/><path class="ball" d="M178 54c6 4 14 4 20 0" stroke="#fff" stroke-width="2.5" fill="none"/>
</svg>`,
};
ILLUSTRATIONS.baby = ILLUSTRATIONS.children;
