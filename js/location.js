const udaipurUrbanLocations = [
  'Hiran Magri Sector 1', 'Hiran Magri Sector 2', 'Hiran Magri Sector 3', 'Hiran Magri Sector 4', 'Hiran Magri Sector 5',
  'Hiran Magri Sector 6', 'Hiran Magri Sector 7', 'Hiran Magri Sector 8', 'Hiran Magri Sector 9', 'Hiran Magri Sector 10',
  'Hiran Magri Sector 11', 'Hiran Magri Sector 12', 'Hiran Magri Sector 13', 'Hiran Magri Sector 14', 'Hiran Magri Sector 15',
  'Pratap Nagar', 'Pratap Nagar Chouraha', 'Pratap Nagar Extension', 'Pratap Nagar Housing Board', 'Pratap Nagar Transport Nagar',
  'Sukher', 'Sukher Chouraha', 'Sukher Industrial Area', 'Bhuwana', 'Bhuwana Bypass', 'Bhuwana Main Road',
  'Bedla', 'Bedla Road', 'Fatehpura', 'New Fatehpura', 'Saheli Nagar', 'Shobhagpura', 'Panchwati',
  'Chetak Circle', 'Chetak Marg', 'Ashok Nagar', 'Bhopalpura', 'Madhuban', 'Madhuban Main Road',
  'University Road', 'Rani Road', 'Ambamata', 'Pula', 'Pahada', 'Ayad', 'Thokar Chouraha',
  'Goverdhan Vilas', 'Govardhan Vilas Main Road', 'Savina', 'Savina Kheda', 'Savina Main Road', 'Titardi',
  'Debari', 'Debari Madri', 'Balicha', 'Balicha Bypass', 'Umarda', 'Umarda Road', 'Airport Road',
  'Maharana Pratap Airport Area', 'Badi', 'Badi Lake Road', 'Badi Road', 'Fateh Sagar Road',
  'Moti Magri', 'Ravji Ka Hata', 'Doodh Talai', 'Pichola', 'Gangaur Ghat', 'Lal Ghat',
  'Chandpole', 'Brahmpole', 'Hathipole', 'Surajpole', 'Udiapole', 'Delhi Gate', 'Court Chouraha',
  'Durga Nursery Road', 'Shastri Circle', 'Tekri', 'Malla Talai', 'Neemach Mata Road', 'Kumharon Ka Bhatta',
  'Purohito Ki Madri', 'Eklingpura', 'Madri', 'Madri Industrial Area', 'Kaladwas', 'Kaladwas Industrial Area',
  'Transport Nagar', 'Adarsh Nagar', 'HMT Colony', 'Rupnagar', 'Sewashram', 'Navratan Complex Area',
  '100 Feet Road Udaipur', 'Nela Road', 'Sisarma Road', 'Arvind Nagar', 'Roshan Ji Ki Bari', 'Sector 14 Govardhan Vilas',
  'Manva Kheda', 'Gariyawas', 'Bedwas', 'Zinc Smelter Area', 'Zawar Mines', 'Jagdish Chowk',
  'Residency Road', 'Old City Udaipur', 'Bhatiyani Chohatta', 'Clock Tower Udaipur', 'Neemach Kheda', 'Piplia',
  'Mavli Road Udaipur', 'Bohra Ganesh Ji', 'Shikarbadi', 'Sajjangarh Road', 'Fatehsagar Pal', 'Shobhagpura Circle'
];

const udaipurRuralLocations = [
  'Badgaon', 'Badgaon Rural', 'Badi Badgaon', 'Nai', 'Naiyon Ki Talai', 'Sisarma', 'Bhatewar', 'Kurabad', 'Nandeshwar',
  'Mavli', 'Mavli Junction', 'Mavli Rural', 'Dabok', 'Dabok Chouraha', 'Kanpur Udaipur', 'Vallabhnagar', 'Bhinder',
  'Fatehnagar', 'Kanod', 'Semari', 'Lasadia', 'Salumber', 'Sarada', 'Kotra', 'Jhadol', 'Gogunda', 'Sayra',
  'Kherwara', 'Rishabhdeo', 'Girwa', 'Girwa Rural', 'Bansda', 'Jaisamand Road', 'Bichhiwara Road', 'Umarda Village',
  'Balicha Village', 'Sakroda', 'Bambora', 'Matasula', 'Intali Khera', 'Dakan Kotra', 'Bhuwana Rural', 'Badi Village',
  'Debari Village', 'Kaya', 'Peepli', 'Nandoli', 'Purohito Ka Gurha', 'Nathdwara Link Udaipur Rural', 'Gudli',
  'Bhilo Ka Bedla', 'Pichli', 'Govardhanpura', 'Madar', 'Madar Rural', 'Dakan Kotda', 'Bhilon Ka Bedla',
  'Chirwa', 'Ghasa', 'Iswal', 'Lakhawali', 'Lakhawali Road', 'Nandeshma', 'Ahad Rural', 'Bhalon Ka Gurha',
  'Nela', 'Jhamar Kotra', 'Bedwas Rural', 'Biliya', 'Piparda', 'Sisarama', 'Titardi Rural', 'Sukher Rural',
  'Bargaon', 'Kheroda', 'Dhar', 'Mewar Industrial Belt Rural', 'Daroli', 'Menar', 'Bambora Road',
  'Dhamdama', 'Rama', 'Rolia', 'Bassi Udaipur', 'Magra', 'Losing', 'Pali Chhoti', 'Pali Badi',
  'Dholi Magri Rural', 'Jasma', 'Ahar River Belt', 'Nai Gram Panchayat', 'Badgaon Gram Panchayat', 'Kurabad Tehsil',
  'Mavli Tehsil', 'Vallabhnagar Tehsil', 'Salumber Tehsil', 'Gogunda Tehsil', 'Jhadol Tehsil', 'Kherwara Tehsil',
  'Rishabhdeo Tehsil', 'Sarada Tehsil', 'Kotra Tehsil', 'Bhinder Tehsil', 'Lasadia Tehsil', 'Bargaon Hills'
];

const udaipurTransitAndLandmarks = [
  'Udaipur City Railway Station', 'Rana Pratap Nagar Railway Station', 'Udaipur Bus Stand', 'Chetak Bus Stand',
  'Goverdhan Vilas Bus Stand', 'Pratap Nagar Bus Depot', 'Udaipur Court Area', 'Collectorate Udaipur',
  'Maharana Bhupal Hospital Area', 'RNT Medical College Area', 'Mohanlal Sukhadia University Area',
  'Sajjangarh Biological Park', 'Sajjangarh Monsoon Palace', 'Fateh Sagar Lake', 'Lake Pichola', 'Swaroop Sagar',
  'Udai Sagar', 'Jaisamand Lake', 'Badi Lake', 'Nehru Garden Area', 'City Palace Area', 'Jag Mandir Access Area',
  'Shilpgram Area', 'Dudh Talai Musical Garden', 'Chetak Circle Market', 'Hathipole Market', 'Bapu Bazaar Udaipur',
  'Clock Tower Market Udaipur', 'Surajpole Market', 'Ashwini Bazaar', 'Old Vegetable Market Udaipur',
  'Maharana Pratap Airport', 'Dabok Airport Road', 'SEZ Road Udaipur', 'RIICO Kaladwas', 'RIICO Madri',
  'RIICO Sukher', 'Zinc Chauraha', 'Town Hall Udaipur', 'Gulab Bagh', 'Saheliyon Ki Bari Area'
];

const udaipurExpandedLocations = [
  'Hiran Magri Sector 16', 'Hiran Magri Sector 17', 'Hiran Magri Sector 18',
  'Hiran Magri Main Road', 'Hiran Magri Link Road', 'Hiran Magri Railway Colony',
  'Rani Sati Area', 'Sundarwas', 'Sundarwas Main Road', 'Sardarpura', 'Meera Nagar',
  'Shastri Nagar Udaipur', 'Chitrakoot Nagar', 'Moti Chohatta', 'Amet Ki Haveli Area',
  'Ravji Ka Hata Circle', 'Polo Ground Udaipur', 'Mohanlal Sukhadia University Road',
  'Sikh Colony Udaipur', 'Lake City Mall Area', 'Urban Square Mall Area', 'Celebration Mall Area',
  'Bhuwana Circle', 'Shobhagpura 100 Feet Link', 'Bhopalpura Main Road', 'Ayad Pulia',
  'Arth Diagnostics Road', 'MB College Road', 'Chetak Bridge Area', 'Udiapole Chauraha',
  'Surajpole Chauraha', 'Hathipole Chauraha', 'Delhi Gate Chauraha', 'Jeevan Tara Area',
  'Reti Stand Udaipur', 'Kharol Colony', 'Sajjan Nagar', 'Panchwati Main Road', 'Alkapuri',
  'Ashok Nagar Main Road', 'Rani Road Fateh Sagar', 'Ambavgarh', 'Brahmpuri Udaipur',
  'Hanuman Ghat Udaipur', 'Navghat', 'Haridas Ji Ki Magri', 'Sajjangarh Biological Park Road',
  'Malla Talai Main Road', 'Kishanpole', 'Gulab Bagh Road', 'Bapu Bazaar Main Lane',
  'Mochiwada Udaipur', 'Sindhi Bazaar Udaipur', 'Nada Khada', 'Dhan Mandi Udaipur',
  'Bhopalpura Circle', 'Shastri Circle Main Road', 'Madhuban Housing Area', 'Navratan Complex',
  'Adinath Nagar', 'Mewar Motor Link Road', 'Court Circle', 'Mahaveer Colony Park',
  'Sector 3 Hiran Magri', 'Sector 4 Hiran Magri', 'Sector 5 Hiran Magri', 'Sector 6 Hiran Magri',
  'Sector 8 Hiran Magri', 'Sector 9 Hiran Magri', 'Sector 11 Hiran Magri', 'Sector 12 Hiran Magri',
  'Sector 13 Hiran Magri', 'Sector 14 Hiran Magri', 'Sector 15 Hiran Magri',

  'Balicha Main Road', 'Balicha Udaipur Chittorgarh Highway', 'Umarda Industrial Belt',
  'Umarda Smart City Road', 'Debari Railway Crossing', 'Debari Power House Area',
  'Madri Industrial Belt', 'Madri Link Road', 'Kaladwas RIICO Phase 1', 'Kaladwas RIICO Phase 2',
  'Kaladwas Highway Front', 'Gudli Industrial Area', 'Gudli Main Road', 'Eklingpura Chouraha',
  'Eklingpura Main Road', 'Titardi Main Road', 'Titardi Bypass', 'Savina Sabji Mandi Area',
  'Savina Transport Hub', 'Govardhan Vilas Bypass', 'Govardhan Vilas Chouraha',
  'Pratap Nagar Central Spine', 'Pratap Nagar Sector 4', 'Pratap Nagar Sector 5',
  'Pratap Nagar Sector 8', 'Pratap Nagar Sector 13', 'Pratap Nagar Airport Link Road',
  'Airport Road Dabok Link', 'Dabok Main Market', 'Dabok Airport Link Circle',
  'Sukher Main Bypass', 'Sukher Bedla Road', 'Bedla Sukher Link', 'Badi Bedla Link',
  'Badi Fatehsagar Link Road', 'Fatehpura Circle', 'Saheli Marg', 'Saheli Nagar Main Road',
  'Shobhagpura Circle', 'Shobhagpura 80 Feet Road', 'Bohra Ganesh Circle',
  'University Main Gate Area', 'Ayad River Front', 'Purohito Ki Madri Link', 'Mansarovar Colony Udaipur',
  'Rupnagar Main Road', 'Arvind Nagar Main Road', 'Nela Main Road',

  'Old City Chandpole', 'Old City Brahmpole', 'Old City Jagdish Chowk', 'Old City Gangaur Ghat',
  'Old City Lal Ghat', 'Old City Hanuman Ghat', 'Old City Ambrai Road', 'Old City City Palace Back Road',
  'Old City Silawatwari', 'Old City Delhi Gate Side', 'Old City Surajpole Side',
  'Old City Udiapole Side', 'Old City Hathipole Side', 'Clock Tower Chowk', 'Dhan Mandi Chowk',
  'Bada Bazaar Udaipur', 'Ghantaghar Area', 'Mochiwada Main Chowk', 'Kamal Gatta Road',
  'Bhatiyani Chohatta Main Road', 'Jagdish Temple Road', 'Kashipuri Udaipur',

  'Girwa Block', 'Girwa Tehsil HQ', 'Badgaon Tehsil', 'Badgaon Main Bazar', 'Badi Block',
  'Nai Village Udaipur', 'Nai Valley Road', 'Sisarma Valley', 'Sisarma Main Village',
  'Lakhawali Village', 'Lakhawali Dam Road', 'Iswal Village', 'Chirwa Valley',
  'Chirwa Ghata', 'Ghasa Village', 'Nandeshwar Village', 'Peepli Village', 'Peepli Main Road',
  'Nandoli Village', 'Kaya Village', 'Gudli Village', 'Bhilon Ka Bedla Village',
  'Bhalon Ka Gurha Village', 'Pichli Village', 'Madar Village', 'Madar Canal Road',
  'Sakroda Village', 'Sakroda Main Road', 'Matasula Village', 'Intali Khera Village',
  'Dakan Kotra Village', 'Dakan Kotda Village', 'Bambora Village', 'Bambora Main Road',
  'Bargaon Village', 'Bargaon Hill Road', 'Bedwas Village', 'Bedwas Main Road', 'Jhamar Kotra Mining Area',
  'Daroli Village', 'Menar Birding Area', 'Kheroda Village', 'Dhar Village Udaipur',
  'Rama Village Udaipur', 'Rolia Village Udaipur', 'Pali Chhoti Village', 'Pali Badi Village',
  'Jasma Village', 'Dhamdama Village', 'Losing Village', 'Bassi Village Udaipur',
  'Magra Village Udaipur',

  'Mavli Town', 'Mavli Main Market', 'Mavli Station Road', 'Mavli Dabok Link',
  'Vallabhnagar Town', 'Vallabhnagar Main Road', 'Bhinder Town', 'Bhinder Main Market',
  'Fatehnagar Town', 'Fatehnagar Main Road', 'Kanod Town', 'Kanod Main Market',
  'Semari Town', 'Semari Main Road', 'Salumber Town', 'Salumber Main Road',
  'Sarada Town', 'Sarada Main Market', 'Lasadia Town', 'Lasadia Main Road',
  'Gogunda Town', 'Gogunda Main Road', 'Jhadol Town', 'Jhadol Main Market',
  'Kotra Town', 'Kotra Main Road', 'Rishabhdeo Town', 'Rishabhdeo Main Road',
  'Kherwara Town', 'Kherwara Main Road', 'Kurabad Main Market', 'Kurabad Udaipur Road',
  'Bhatewar Main Market', 'Bhatewar Mavli Road', 'Nandeshma Village',

  'Ahar Udaipur', 'Ahar River Front', 'Ahar Museum Area', 'Ahar Main Road',
  'SEZ Balicha Road', 'RIICO Sukher Phase 1', 'RIICO Sukher Phase 2', 'RIICO Madri Phase 1',
  'RIICO Madri Phase 2', 'RIICO Kaladwas Phase 3', 'Transport Nagar Savina', 'Transport Nagar Pratap Nagar',
  'Zinc Chauraha Main Road', 'Zawar Road', 'Zawar Mines Colony', 'Shikarbadi Airport Bypass',
  'Shikarbadi Main Gate Area', 'Sajjangarh Road Link', 'Neemach Mata Temple Road',
  'Fateh Sagar Pal Road', 'Rani Road Malla Talai Link', 'Badi Lake Main Entry',
  'Dudh Talai Ropeway Area', 'Karni Mata Ropeway Area', 'Shilpgram Fateh Sagar Link',
  'Town Hall Road', 'Collectorate Road', 'Court Road Udaipur', 'MB Hospital Road',
  'RNT Campus Road', 'Ashwini Bazaar Main Road', 'Surajpole Market Main Road',
  'Hathipole Market Main Road', 'Chetak Market Main Road', 'Bapu Bazaar Main Road',
  'Old Sabji Mandi Road', 'Udaipur Smart City Office Area'
];

const udaipurSupplementalLocations = [
  'Sector 3 Hiran Magri', 'Sector 4 Hiran Magri', 'Sector 5 Hiran Magri', 'Sector 6 Hiran Magri',
  'Sector 8 Hiran Magri', 'Sector 9 Hiran Magri', 'Sector 11 Hiran Magri', 'Sector 14 Hiran Magri',
  'Mewar Colony', 'Roop Sagar Road', 'Mahaveer Colony Park', 'Gayariyawas',
  'R.K. Circle', 'Baleecha', 'Aayaad', 'Thoor', 'Bedla Village Road',
  'Purohiton Ki Madri', 'Dakan Kotra Road', 'Moti Magri Road', 'Rani Road Udaipur',
  'Saheliyon Ki Bari Road', 'Chetak Marg Udaipur', 'Madhav Vihar', 'Shanti Nagar Udaipur',
  'Titardi Main Road', 'Sector 14 Main Road', 'Sukhadia Circle Area', 'MBS Hospital Road',
  'Bapu Bazar', 'Ghantaghar Udaipur', 'Mochiwada', 'Sindhi Bazar Udaipur',
  'Bhinder Ki Haveli Area', 'Rampura Chouraha', 'Jeevan Tara Circle', 'Shastri Nagar Main Road',
  'Arawali Vatika Road', 'Neemuch Kheda', 'Goverdhan Sagar', 'Balaji Nagar Udaipur',
  'Keshav Nagar Udaipur', 'Machla Magra', 'Nohra Udaipur', 'RTO Office Road Udaipur',
  'Paras Tiraha', 'Ravji Ka Hata Main Road', 'Court Circle Udaipur', 'Mukherjee Chowk',
];

const normalizedUnique = (items) => [...new Set(
  (items || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean),
)];

const fromMultiline = (rawText) => normalizedUnique(
  String(rawText || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean),
);

const officialUdaipurData = window.PROPERTYSETU_OFFICIAL_UDAIPUR || {};
const officialUdaipurSubDistricts = normalizedUnique(officialUdaipurData.subDistricts || []);
const officialUdaipurAreaNames = normalizedUnique(officialUdaipurData.areaNames || []);
const officialUdaipurLocations = normalizedUnique([
  ...officialUdaipurSubDistricts,
  ...officialUdaipurAreaNames,
]);

const udaipurGoogleMapsUrbanCoverage = fromMultiline(`
Alkapuri
Ambamata
Ambavgarh
Ashok Nagar Udaipur
A-Block Hiran Magri
Ahar Main Road
Ayad River Side
Ayad Main Market
Badi Road Udaipur
Bapu Bazaar
Brahmpuri
Brahmpole Road
Chetak Circle
Chitrakoot Nagar Udaipur
Court Circle Udaipur
Dhan Mandi
Delhi Gate Udaipur
Durga Nursery Road
Fatehpura Circle
Gariyawas Udaipur
Goverdhan Vilas
Govardhan Vilas
Haridas Ji Ki Magri
Hathipole
Jagdish Chowk
Jeevan Tara
Kalaji Goraji
Kishanpole Udaipur
Lake City Mall Road
Lal Ghat
Madhuban Udaipur
Malla Talai
Mansarovar Colony Udaipur
Meera Nagar Udaipur
Moti Chohatta
Nada Khada
New Bhupalpura
Old City Udaipur
Panchwati Udaipur
Polo Ground
Pulla Bhuwana
Ravji Ka Hata
Residency Road
Reti Stand
RNT Road
Rupnagar Udaipur
Saheli Marg
Sardarpura Udaipur
Savina
Shakti Nagar Udaipur
Shastri Circle
Shobhagpura
Sukhadiya Circle
Sukher
Surajpole
Tekri Udaipur
Thokar Chouraha
Town Hall Udaipur
Udaipole
University Road
Urban Square Road
Zinc Park Area
`);

const udaipurGoogleMapsRuralCoverage = fromMultiline(`
Aabankad
Adkalia
Ahar
Akal
Akodara
Ambasa
Ambashavgarh
Amba Talai
Amloi
Amod
Anandpura
Anyelkalan
Ar
Asmara
Bada
Bajaya
Balicha
Bambora
Banad
Baran
Bari
Barniya
Bassiya
Bedla
Beechri
Beelakalan
Beyana
Bhallo Ki Kui
Bhalon Ka Gurha
Bhalon Ka Guda
Bhanda
Bhatewar
Bhoinda Kalan
Bhojon Ki Patiya
Bhutala
Biliya
Birad
Bor Ka Khera
Bori
Bormata
Bujra
Chakuda
Chansda
Chirwa
Dada
Dakan Kotada
Dakan Kotra
Dara
Deimata
Delwara
Dhamdama
Dhanet
Dhinkli
Dholi Magri
Dholi Ghati
Dholiya
Dhol Ki Pati
Dudli
Eklingpura
Gadriya Ka Gurha
Garnala Kotra
Ghasiyar
Gopalpura
Gordhan Vilas
Gurli
Kaliwas
Kantun
Kaya
Kayampura
Kelwas
Khajoori
Kharwa
Kherad
Kheroda
Kiwara
Lakhawali
Lalpur
Limbali
Liyo Ka Gurha
Lohra
Losesra
Madri
Mahuda
Makad Dev
Mandwa
Manna Ka Gurha
Masaron Ki Obri
Matasara
Matasula
Morwaniya
Nai
Nala
Namri
Nandeshma
Nandwel
Nar
Nela
Nokha
Pachar
Pacholi
Padarda
Paduna
Pai
Pala
Pali
Pandrwa
Pari
Parola
Peepli
Phoota Talab
Piparda
Purohito Ka Gurha
Raisinghpura
Rama
Rampura
Raniya
Ratanpura
Salaron Ki Madri
Salera Khurd
Saredi
Satmala
Savina Khera
Seesarma
Shahgarh
Shobhagpura
Sisarma
Sisvi
Siyakhedi
Sunderpura
Surana
Titardi
Ubeshwar Ji
Umarda
Undri
Uniyara
Vallabh
Varda
Yeroora
`);

const mergedUrbanLocations = normalizedUnique([
  ...udaipurUrbanLocations,
  ...udaipurGoogleMapsUrbanCoverage,
]);

const mergedRuralLocations = normalizedUnique([
  ...udaipurRuralLocations,
  ...udaipurGoogleMapsRuralCoverage,
  ...officialUdaipurSubDistricts,
  ...officialUdaipurAreaNames,
]);

const mergedExpandedLocations = normalizedUnique([
  ...udaipurExpandedLocations,
  ...udaipurSupplementalLocations,
  ...udaipurGoogleMapsUrbanCoverage,
  ...udaipurGoogleMapsRuralCoverage,
  ...officialUdaipurLocations,
]);

const districtNodes = [
  'Udaipur, Rajasthan',
  'Udaipur District, Rajasthan',
  'Udaipur District Headquarters',
  'Girwa (Udaipur District)',
];

const fortsAndPalaces = normalizedUnique(
  [...udaipurTransitAndLandmarks, ...mergedExpandedLocations].filter((name) =>
    /(fort|palace|ghat|jagdish|city palace|monsoon|mata|temple|lake|sagar|haveli|chowk)/i.test(name)),
);

const transitAndServices = normalizedUnique(
  udaipurTransitAndLandmarks.filter((name) =>
    /(station|bus|airport|road|market|hospital|college|court|collectorate|riico|sez|town hall)/i.test(name)),
);

const baseUdaipurLocations = normalizedUnique([
  ...districtNodes,
  ...mergedUrbanLocations,
  ...mergedRuralLocations,
  ...udaipurTransitAndLandmarks,
  ...mergedExpandedLocations,
  ...officialUdaipurLocations,
]);

window.PROPERTYSETU_LOCATION_GROUPS = [
  {
    id: 'districts',
    title: 'DISTRICTS',
    icon: '📍',
    items: districtNodes,
  },
  {
    id: 'forts',
    title: 'FORTS & PALACES',
    icon: '🏰',
    items: fortsAndPalaces,
  },
  {
    id: 'urban',
    title: 'URBAN LOCALITIES',
    icon: '🏙️',
    items: mergedUrbanLocations,
  },
  {
    id: 'rural',
    title: 'RURAL & TEHSIL',
    icon: '🌾',
    items: mergedRuralLocations,
  },
  {
    id: 'official',
    title: 'OFFICIAL CENSUS UDAIPUR',
    icon: '🧾',
    items: officialUdaipurLocations,
  },
  {
    id: 'transit',
    title: 'TRANSIT & SERVICES',
    icon: '🚉',
    items: transitAndServices,
  },
  {
    id: 'more',
    title: 'MORE UDAIPUR AREAS',
    icon: '📌',
    items: mergedExpandedLocations,
  },
];

const udaipurSearchAliases = baseUdaipurLocations.flatMap((location) => {
  const normalized = String(location || '').trim();
  if (!normalized) return [];
  const aliases = new Set([normalized]);
  if (!/\budaipur\b/i.test(normalized)) {
    aliases.add(`${normalized}, Udaipur`);
    aliases.add(`${normalized}, Udaipur, Rajasthan`);
  } else if (!/\brajasthan\b/i.test(normalized)) {
    aliases.add(`${normalized}, Rajasthan`);
  }

  if (/\bvillage\b/i.test(normalized)) {
    aliases.add(normalized.replace(/\bvillage\b/ig, '').replace(/\s{2,}/g, ' ').trim());
  }

  if (normalized.includes(',')) {
    aliases.add(normalized.replace(/,\s*/g, ' '));
  }

  return [...aliases].filter(Boolean);
});

window.PROPERTYSETU_LOCATIONS = [...new Set(udaipurSearchAliases)]
  .sort((a, b) => a.localeCompare(b));
