// Gom 521 lớp của YAMNet (tên tiếng Anh theo AudioSet) thành các nhóm thân thuộc bằng tiếng Việt.
//
// kind quyết định màu thẻ kết quả:
//   danger  – đỏ: nguy hiểm thực sự (súng, nổ, còi hú, chuông báo cháy, kính vỡ)
//   caution – cam: cần chú ý (còi xe, la hét, công trường, pháo)
//   people  – xanh dương: con người, trẻ em, âm nhạc
//   nature  – xanh lá: động vật, mưa, gió, nước
//   ambient – xám: tiếng nền (máy lạnh, ồn nền, yên tĩnh)
//
// weight: trọng số khi xếp hạng. Tiếng nền (máy lạnh, ồn nền) bị giảm mạnh để không "nuốt" tiếng chính
// như chó sủa; tiếng nói/nhạc giảm nhẹ vì YAMNet hay đoán dư hai nhóm này.

export const KIND_INFO = {
  danger:  { label: 'Nguy hiểm', tone: 'red' },
  caution: { label: 'Cần chú ý', tone: 'amber' },
  people:  { label: 'Con người & âm nhạc', tone: 'blue' },
  nature:  { label: 'Thiên nhiên & động vật', tone: 'green' },
  ambient: { label: 'Tiếng nền', tone: 'gray' },
  personal: { label: 'Âm thanh của bạn', tone: 'blue' },
};

export const GROUPS = [
  // ---- Động vật
  { id: 'dog', vi: 'Chó sủa', icon: 'dog', kind: 'nature', weight: 1.15, fun: 'Gâu gâu! Có một bạn cún ở gần đây.',
    names: ['Dog', 'Bark', 'Yip', 'Howl', 'Bow-wow', 'Growling', 'Whimper (dog)'] },
  { id: 'cat', vi: 'Mèo kêu', icon: 'cat', kind: 'nature', weight: 1.1, fun: 'Meo meo~ Một bé mèo đang lên tiếng.',
    names: ['Cat', 'Purr', 'Meow', 'Hiss', 'Caterwaul'] },
  { id: 'poultry', vi: 'Gà, vịt', icon: 'rooster', kind: 'nature', weight: 1.05, fun: 'Ò ó o! Gà vịt đang gọi nhau.',
    names: ['Fowl', 'Chicken, rooster', 'Cluck', 'Crowing, cock-a-doodle-doo', 'Turkey', 'Gobble', 'Duck', 'Quack', 'Goose', 'Honk'] },
  { id: 'livestock', vi: 'Gia súc (bò, heo, dê…)', icon: 'cow', kind: 'nature', weight: 1.0,
    names: ['Livestock, farm animals, working animals', 'Horse', 'Clip-clop', 'Neigh, whinny', 'Cattle, bovinae', 'Moo', 'Cowbell', 'Pig', 'Oink', 'Goat', 'Bleat', 'Sheep'] },
  { id: 'bird', vi: 'Chim hót', icon: 'bird', kind: 'nature', weight: 1.0, fun: 'Líu lo líu lo – tiếng chim.',
    names: ['Bird', 'Bird vocalization, bird call, bird song', 'Chirp, tweet', 'Squawk', 'Pigeon, dove', 'Coo', 'Crow', 'Caw', 'Owl', 'Hoot', 'Bird flight, flapping wings', 'Wild animals'] },
  { id: 'insect', vi: 'Côn trùng, ếch nhái', icon: 'bug', kind: 'nature', weight: 1.0,
    names: ['Insect', 'Cricket', 'Mosquito', 'Fly, housefly', 'Buzz', 'Bee, wasp, etc.', 'Frog', 'Croak', 'Snake', 'Rattle'] },
  { id: 'animal', vi: 'Tiếng động vật', icon: 'paw', kind: 'nature', weight: 0.75,
    names: ['Animal', 'Domestic animals, pets', 'Roaring cats (lions, tigers)', 'Roar', 'Rodents, rats, mice', 'Mouse', 'Patter', 'Whale vocalization'] },

  // ---- Con người
  { id: 'children', vi: 'Trẻ em nô đùa', icon: 'children', kind: 'people', weight: 1.05, fun: 'Các bé đang vui chơi – không có gì đáng lo.',
    names: ['Children playing', 'Child speech, kid speaking', 'Children shouting', 'Baby laughter', 'Giggle'] },
  { id: 'baby', vi: 'Em bé khóc', icon: 'baby', kind: 'people', weight: 1.1,
    names: ['Baby cry, infant cry', 'Crying, sobbing', 'Whimper', 'Wail, moan'] },
  { id: 'speech', vi: 'Tiếng người nói', icon: 'speech', kind: 'people', weight: 0.8,
    names: ['Speech', 'Male speech, man speaking', 'Female speech, woman speaking', 'Conversation', 'Narration, monologue', 'Babbling', 'Speech synthesizer', 'Whispering'] },
  { id: 'crowd', vi: 'Đám đông, vỗ tay', icon: 'crowd', kind: 'people', weight: 0.95,
    names: ['Crowd', 'Chatter', 'Hubbub, speech noise, speech babble', 'Cheering', 'Applause', 'Clapping', 'Children shouting'] },
  { id: 'laugh', vi: 'Tiếng cười', icon: 'laugh', kind: 'people', weight: 1.0,
    names: ['Laughter', 'Chuckle, chortle', 'Belly laugh', 'Snicker'] },
  { id: 'shout', vi: 'La hét', icon: 'shout', kind: 'caution', weight: 1.0,
    names: ['Shout', 'Yell', 'Screaming', 'Bellow', 'Battle cry', 'Whoop'] },
  { id: 'body', vi: 'Ho, hắt hơi, ngáy', icon: 'cough', kind: 'people', weight: 1.0,
    names: ['Cough', 'Sneeze', 'Throat clearing', 'Sniff', 'Breathing', 'Snoring', 'Gasp', 'Wheeze', 'Pant', 'Burping, eructation', 'Hiccup'] },
  { id: 'footsteps', vi: 'Bước chân', icon: 'steps', kind: 'people', weight: 0.95,
    names: ['Walk, footsteps', 'Run', 'Shuffle'] },
  { id: 'music', vi: 'Âm nhạc, ca hát', icon: 'music', kind: 'people', weight: 0.85,
    names: ['Singing', 'Choir', 'Yodeling', 'Chant', 'Male singing', 'Female singing', 'Child singing', 'Rapping', 'Humming', 'Whistling'],
    range: ['Music', 'Wind'] }, // mọi lớp từ "Music" tới trước "Wind" trong bảng lớp YAMNet

  // ---- Giao thông
  { id: 'motorbike', vi: 'Xe máy', icon: 'motorbike', kind: 'ambient', weight: 1.0,
    names: ['Motorcycle', 'Light engine (high frequency)', 'Accelerating, revving, vroom', 'Dirt bike'] },
  { id: 'horn', vi: 'Còi xe', icon: 'horn', kind: 'caution', weight: 1.1,
    names: ['Vehicle horn, car horn, honking', 'Toot', 'Air horn, truck horn', 'Bicycle bell'] },
  { id: 'traffic', vi: 'Xe cộ, đường phố', icon: 'car', kind: 'ambient', weight: 0.8,
    names: ['Traffic noise, roadway noise', 'Vehicle', 'Motor vehicle (road)', 'Car', 'Car passing by', 'Bus', 'Truck', 'Tire squeal', 'Skidding', 'Race car, auto racing', 'Air brake', 'Reversing beeps', 'Ice cream truck, ice cream van', 'Bicycle', 'Skateboard', 'Outside, urban or manmade'] },
  { id: 'siren', vi: 'Còi hú (cứu thương, cứu hỏa, công an)', icon: 'siren', kind: 'danger', weight: 1.15,
    names: ['Siren', 'Police car (siren)', 'Ambulance (siren)', 'Fire engine, fire truck (siren)', 'Emergency vehicle', 'Civil defense siren'] },
  { id: 'train', vi: 'Tàu hỏa, tàu điện', icon: 'train', kind: 'ambient', weight: 1.0,
    names: ['Rail transport', 'Train', 'Train whistle', 'Train horn', 'Railroad car, train wagon', 'Train wheels squealing', 'Subway, metro, underground'] },
  { id: 'aircraft', vi: 'Máy bay, trực thăng', icon: 'plane', kind: 'ambient', weight: 1.0,
    names: ['Aircraft', 'Aircraft engine', 'Jet engine', 'Propeller, airscrew', 'Helicopter', 'Fixed-wing aircraft, airplane'] },
  { id: 'boat', vi: 'Tàu thuyền', icon: 'boat', kind: 'ambient', weight: 1.0,
    names: ['Boat, Water vehicle', 'Sailboat, sailing ship', 'Rowboat, canoe, kayak', 'Motorboat, speedboat', 'Ship'] },
  { id: 'engine', vi: 'Động cơ nổ máy', icon: 'engine', kind: 'ambient', weight: 0.9,
    names: ['Engine', 'Medium engine (mid frequency)', 'Heavy engine (low frequency)', 'Engine knocking', 'Engine starting', 'Idling', 'Lawn mower'] },

  // ---- Nguy hiểm / báo động
  { id: 'gunshot', vi: 'Tiếng súng, tiếng nổ', icon: 'boom', kind: 'danger', weight: 1.2,
    names: ['Gunshot, gunfire', 'Machine gun', 'Fusillade', 'Artillery fire', 'Cap gun', 'Explosion', 'Boom', 'Eruption'] },
  { id: 'fireworks', vi: 'Pháo hoa, pháo nổ', icon: 'fireworks', kind: 'caution', weight: 1.1,
    names: ['Fireworks', 'Firecracker', 'Burst, pop'] },
  { id: 'alarm', vi: 'Chuông báo động, báo cháy', icon: 'alarm', kind: 'danger', weight: 1.15,
    names: ['Alarm', 'Smoke detector, smoke alarm', 'Fire alarm', 'Car alarm', 'Buzzer', 'Foghorn'] },
  { id: 'glass', vi: 'Kính vỡ', icon: 'glass', kind: 'danger', weight: 1.15,
    names: ['Shatter', 'Breaking'] },
  { id: 'fire', vi: 'Lửa cháy lách tách', icon: 'fire', kind: 'caution', weight: 1.0,
    names: ['Fire', 'Crackle'] },

  // ---- Công trường, máy móc
  { id: 'construction', vi: 'Công trường, máy khoan', icon: 'drill', kind: 'caution', weight: 1.05,
    names: ['Jackhammer', 'Drill', 'Power tool', 'Hammer', 'Sawing', 'Sanding', 'Filing (rasp)', 'Tools', 'Chainsaw', 'Pneumatic tool'] },
  { id: 'ac', vi: 'Máy lạnh, quạt', icon: 'fan', kind: 'ambient', weight: 0.55,
    names: ['Air conditioning', 'Mechanical fan'] },
  { id: 'appliance', vi: 'Đồ gia dụng, bếp', icon: 'blender', kind: 'ambient', weight: 0.95,
    names: ['Vacuum cleaner', 'Hair dryer', 'Blender', 'Microwave oven', 'Electric shaver, electric razor', 'Electric toothbrush', 'Sewing machine', 'Dishes, pots, and pans', 'Cutlery, silverware', 'Frying (food)', 'Chopping (food)', 'Boiling', 'Kettle whistle'] },
  { id: 'bell', vi: 'Chuông điện thoại, chuông cửa', icon: 'bell', kind: 'people', weight: 1.0,
    names: ['Telephone', 'Telephone bell ringing', 'Ringtone', 'Telephone dialing, DTMF', 'Dial tone', 'Busy signal', 'Alarm clock', 'Doorbell', 'Ding-dong', 'Bell', 'Church bell', 'Jingle bell', 'Wind chime', 'Bicycle bell', 'Ding'] },
  { id: 'door', vi: 'Cửa, gõ cửa', icon: 'door', kind: 'people', weight: 0.95,
    names: ['Door', 'Knock', 'Slam', 'Sliding door', 'Squeak', 'Cupboard open or close', 'Drawer open or close', 'Tap'] },
  { id: 'office', vi: 'Gõ phím, văn phòng', icon: 'keyboard', kind: 'people', weight: 0.95,
    names: ['Typing', 'Typewriter', 'Computer keyboard', 'Writing', 'Printer', 'Cash register', 'Clock', 'Tick', 'Tick-tock', 'Camera', 'Single-lens reflex camera'] },
  { id: 'tv', vi: 'TV, radio', icon: 'tv', kind: 'people', weight: 0.85,
    names: ['Television', 'Radio'] },

  // ---- Thiên nhiên
  { id: 'rain', vi: 'Mưa, sấm sét', icon: 'rain', kind: 'nature', weight: 1.0,
    names: ['Rain', 'Raindrop', 'Rain on surface', 'Thunderstorm', 'Thunder'] },
  { id: 'water', vi: 'Nước chảy', icon: 'water', kind: 'nature', weight: 0.9,
    names: ['Water', 'Stream', 'Waterfall', 'Ocean', 'Waves, surf', 'Splash, splatter', 'Water tap, faucet', 'Sink (filling or washing)', 'Bathtub (filling or washing)', 'Toilet flush', 'Pour', 'Drip', 'Gurgling', 'Trickle, dribble', 'Fill (with liquid)', 'Liquid'] },
  { id: 'wind', vi: 'Gió', icon: 'wind', kind: 'ambient', weight: 0.7,
    names: ['Wind', 'Rustling leaves', 'Wind noise (microphone)'] },

  // ---- Nền
  { id: 'silence', vi: 'Yên tĩnh', icon: 'moon', kind: 'ambient', weight: 0.6,
    names: ['Silence'] },
  { id: 'noise', vi: 'Tiếng ồn nền', icon: 'noise', kind: 'ambient', weight: 0.45,
    names: ['White noise', 'Pink noise', 'Static', 'Mains hum', 'Hum', 'Noise', 'Environmental noise', 'Inside, small room', 'Inside, large room or hall', 'Inside, public space', 'Outside, rural or natural', 'Sound effect', 'Echo', 'Reverberation', 'Field recording', 'Mechanisms', 'Whir', 'Rumble', 'Vibration'] },
];

export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

// Nhóm dùng để mô tả "khung cảnh" chứ không phải sự kiện chính
export const AMBIENT_IDS = new Set(['ac', 'noise', 'silence', 'wind', 'traffic']);

// Danh sách hiển thị ở trang chủ/hướng dẫn: những nhóm có thể nhận diện
export function publicGroups() {
  return GROUPS.filter((g) => !['noise', 'silence', 'animal'].includes(g.id));
}

/**
 * Tạo bảng ánh xạ chỉ số lớp YAMNet -> danh sách nhóm.
 * classNames: mảng 521 tên tiếng Anh theo đúng thứ tự trong yamnet_class_map.csv
 * Trả về { members: {groupId: [idx...]}, unmapped: [idx...] }
 */
export function buildGroupIndex(classNames) {
  const pos = new Map(classNames.map((n, i) => [n, i]));
  const members = {};
  const used = new Set();
  for (const g of GROUPS) {
    const idx = new Set();
    for (const n of g.names) if (pos.has(n)) idx.add(pos.get(n));
    if (g.range) {
      const a = pos.get(g.range[0]);
      const b = pos.get(g.range[1]);
      if (a != null && b != null && b > a) for (let i = a; i < b; i++) idx.add(i);
    }
    members[g.id] = [...idx];
    idx.forEach((i) => used.add(i));
  }
  const unmapped = classNames.map((_, i) => i).filter((i) => !used.has(i));
  return { members, unmapped };
}

/** Nhóm cho một chỉ số lớp (dùng để hiển thị tên lớp chi tiết). */
export function groupsOfClass(index, groupIndex) {
  const out = [];
  for (const [gid, idx] of Object.entries(groupIndex.members)) if (idx.includes(index)) out.push(gid);
  return out;
}

// Một số tên lớp YAMNet hay gặp được dịch để hiển thị ở phần "chi tiết"
export const CLASS_VI = {
  'Dog': 'Chó', 'Bark': 'Tiếng sủa', 'Yip': 'Sủa ăng ẳng', 'Howl': 'Tru', 'Bow-wow': 'Gâu gâu', 'Growling': 'Gầm gừ',
  'Cat': 'Mèo', 'Meow': 'Meo meo', 'Purr': 'Rừ rừ', 'Speech': 'Tiếng nói', 'Music': 'Âm nhạc',
  'Children playing': 'Trẻ em chơi đùa', 'Air conditioning': 'Máy lạnh', 'Mechanical fan': 'Quạt máy',
  'Vehicle horn, car horn, honking': 'Còi xe', 'Siren': 'Còi hú', 'Motorcycle': 'Xe máy',
  'Traffic noise, roadway noise': 'Tiếng xe cộ', 'Silence': 'Im lặng', 'Gunshot, gunfire': 'Tiếng súng',
  'Jackhammer': 'Búa khoan', 'Drill': 'Máy khoan', 'Rain': 'Mưa', 'Bird': 'Chim', 'Animal': 'Động vật',
  'Engine': 'Động cơ', 'Idling': 'Nổ máy cầm chừng', 'Car': 'Ô tô', 'Laughter': 'Tiếng cười', 'Baby cry, infant cry': 'Em bé khóc',
  'Domestic animals, pets': 'Vật nuôi', 'Inside, small room': 'Trong phòng nhỏ', 'Outside, urban or manmade': 'Ngoài trời, đô thị',
  'Hum': 'Tiếng ù', 'White noise': 'Nhiễu trắng', 'Noise': 'Tiếng ồn', 'Explosion': 'Tiếng nổ', 'Fireworks': 'Pháo hoa',
  'Wind': 'Gió', 'Water': 'Nước', 'Chicken, rooster': 'Gà', 'Crowing, cock-a-doodle-doo': 'Gà gáy',
};
