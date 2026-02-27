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

window.PROPERTYSETU_LOCATIONS = [...new Set([
  ...udaipurUrbanLocations,
  ...udaipurRuralLocations,
  ...udaipurTransitAndLandmarks,
])].sort((a, b) => a.localeCompare(b));
