/**
 * Comprehensive Indian States, Districts & Precise Geographic Coordinates
 * Used across VyaparSetu for Map Positioning, APMC Mandi alignment, and UDYAM intelligence.
 */

export interface DistrictGeo {
  name: string;
  lat: number;
  lng: number;
  odop?: string;
}

export interface StateData {
  state: string;
  districts: DistrictGeo[];
}

export const ALL_INDIAN_STATES_DATA: StateData[] = [
  {
    state: "Maharashtra",
    districts: [
      { name: "Pune", lat: 18.5204, lng: 73.8567, odop: "Processed Food & Agro (Tomato, Jaggery)" },
      { name: "Nashik", lat: 19.9975, lng: 73.7898, odop: "Grapes, Onion & Wine Value Addition" },
      { name: "Kolhapur", lat: 16.705, lng: 74.2433, odop: "Jaggery (Kolhapuri Gul), Leather & Foundry" },
      { name: "Nagpur", lat: 21.1458, lng: 79.0882, odop: "Orange Processing & Agro-Logistics" },
      { name: "Chhatrapati Sambhajinagar", lat: 19.8762, lng: 75.3433, odop: "Paithani Silk & Auto Engineering" },
      { name: "Thane", lat: 19.2183, lng: 72.9781, odop: "Marine Products & Light Engineering" },
      { name: "Mumbai City", lat: 18.922, lng: 72.8347, odop: "Financial Services & Apparel" },
      { name: "Mumbai Suburban", lat: 19.076, lng: 72.8777, odop: "Gems, Jewellery & Commerce" },
      { name: "Solapur", lat: 17.6599, lng: 75.9064, odop: "Chaddar, Terry Towels & Pomegranate" },
      { name: "Sangli", lat: 16.8524, lng: 74.5815, odop: "Turmeric, Raisins & Sugarcane" },
      { name: "Satara", lat: 17.6805, lng: 74.0183, odop: "Strawberries (Mahabaleshwar) & Dairy" },
      { name: "Ahmednagar", lat: 19.0952, lng: 74.7496, odop: "Sugar, Dairy & Millets" },
      { name: "Jalgaon", lat: 21.0077, lng: 75.5626, odop: "Banana Processing & Gold Ornaments" },
      { name: "Amravati", lat: 20.9374, lng: 77.7796, odop: "Cotton Ginning & Textiles" },
      { name: "Akola", lat: 20.7002, lng: 77.0082, odop: "Pulses (Dal Milling) & Oilseeds" },
      { name: "Latur", lat: 18.4088, lng: 76.5604, odop: "Soybean Oil & Pulses Trading" },
      { name: "Nanded", lat: 19.1383, lng: 77.321, odop: "Banana & Cotton Processing" },
      { name: "Wardha", lat: 20.7453, lng: 78.6022, odop: "Khadi, Tur Dal & Cotton" },
      { name: "Raigad", lat: 18.5158, lng: 73.1822, odop: "Rice Milling & Marine Fisheries" },
      { name: "Ratnagiri", lat: 16.9902, lng: 73.312, odop: "Alphonso Mango & Cashew Processing" },
      { name: "Sindhudurg", lat: 16.0353, lng: 73.6895, odop: "Kokum, Cashew & Tourism" },
    ],
  },
  {
    state: "Uttar Pradesh",
    districts: [
      { name: "Varanasi", lat: 25.3176, lng: 82.9739, odop: "Banarasi Silk Sarees & Wooden Toys" },
      { name: "Lucknow", lat: 26.8467, lng: 80.9462, odop: "Chikan & Zari Zardozi Embroidery" },
      { name: "Kanpur Nagar", lat: 26.4499, lng: 80.3319, odop: "Leather Products & Footwear" },
      { name: "Agra", lat: 27.1767, lng: 78.0081, odop: "Leather Goods & Stone Inlay Work" },
      { name: "Prayagraj", lat: 25.4358, lng: 81.8463, odop: "Guava Processing & Glassware" },
      { name: "Gorakhpur", lat: 26.7606, lng: 83.3732, odop: "Terracotta Pottery & Ready-made Garments" },
      { name: "Bareilly", lat: 28.367, lng: 79.4304, odop: "Zari Zardozi & Bamboo Handicrafts" },
      { name: "Meerut", lat: 28.9845, lng: 77.7064, odop: "Sports Goods & Musical Instruments" },
      { name: "Moradabad", lat: 28.8386, lng: 78.7733, odop: "Metal Craft & Brassware" },
      { name: "Aligarh", lat: 27.8974, lng: 78.088, odop: "Locks & Hardware Fittings" },
      { name: "Saharanpur", lat: 29.964, lng: 77.546, odop: "Wood Carving & Timber Processing" },
      { name: "Bhadohi", lat: 25.3942, lng: 82.5694, odop: "Handmade Woolen Carpets" },
      { name: "Mathura", lat: 27.4924, lng: 77.6737, odop: "Sanitary Ware & Milk Peda" },
      { name: "Ayodhya", lat: 26.7922, lng: 82.1998, odop: "Jaggery (Ayodhya Gur) & Religious Crafts" },
      { name: "Noida (Gautam Buddha Nagar)", lat: 28.5355, lng: 77.391, odop: "Electronics & Readymade Garments" },
      { name: "Ghaziabad", lat: 28.6692, lng: 77.4538, odop: "Engineering Goods & Packaging" },
    ],
  },
  {
    state: "Bihar",
    districts: [
      { name: "Patna", lat: 25.5941, lng: 85.1376, odop: "Makhana & Food Processing" },
      { name: "Muzaffarpur", lat: 26.1209, lng: 85.3647, odop: "Shahi Litchi Value Addition" },
      { name: "Gaya", lat: 24.7914, lng: 85.0002, odop: "Stone Craft & Tilkut Confectionery" },
      { name: "Bhagalpur", lat: 25.2425, lng: 86.9842, odop: "Tussar Bhagalpuri Silk Handloom" },
      { name: "Darbhanga", lat: 26.1542, lng: 85.8918, odop: "Makhana & Mithila Paintings" },
      { name: "Purnia", lat: 25.7771, lng: 87.4753, odop: "Jute Products & Maize Processing" },
      { name: "Samastipur", lat: 25.8627, lng: 85.7811, odop: "Tobacco & Turmeric Processing" },
      { name: "Nalanda", lat: 25.1357, lng: 85.4619, odop: "Khaja Sweet & Agro-Tourism" },
      { name: "Rohtas", lat: 24.9585, lng: 84.0152, odop: "Rice Milling & Stone Grit" },
      { name: "Vaishali", lat: 25.6841, lng: 85.2155, odop: "Banana Products & Honey" },
    ],
  },
  {
    state: "Madhya Pradesh",
    districts: [
      { name: "Indore", lat: 22.7196, lng: 75.8577, odop: "Ready-to-Eat Namkeen & Snacks" },
      { name: "Bhopal", lat: 23.2599, lng: 77.4126, odop: "Zari Zardozi & Engineering Goods" },
      { name: "Jabalpur", lat: 23.1815, lng: 79.9864, odop: "Readymade Garments & Green Peas" },
      { name: "Gwalior", lat: 26.2183, lng: 78.1828, odop: "Sandstone Tiles & Handicrafts" },
      { name: "Ujjain", lat: 23.1765, lng: 75.7885, odop: "Batik Print Fabrics & Soya Processing" },
      { name: "Chhindwara", lat: 22.0574, lng: 78.9382, odop: "Orange Processing & Potato Starch" },
      { name: "Hoshangabad", lat: 22.7483, lng: 77.7289, odop: "Wheat (Sharbati) & Dairy" },
      { name: "Ratlam", lat: 23.3315, lng: 75.0367, odop: "Ratlam Sev & Gold Ornaments" },
      { name: "Dewas", lat: 22.9676, lng: 76.0534, odop: "Soybean Oil Extraction & Leather" },
    ],
  },
  {
    state: "Gujarat",
    districts: [
      { name: "Ahmedabad", lat: 23.0225, lng: 72.5714, odop: "Textile Processing & Chemicals" },
      { name: "Surat", lat: 21.1702, lng: 72.8311, odop: "Synthetic Textiles & Diamond Polishing" },
      { name: "Vadodara", lat: 22.3072, lng: 73.1812, odop: "Heavy Engineering & Bio-Fertilizers" },
      { name: "Rajkot", lat: 22.3039, lng: 70.8022, odop: "Diesel Engines, Pump Sets & Imitation Jewellery" },
      { name: "Bhavnagar", lat: 21.7645, lng: 72.1519, odop: "Dehydrated Onions & Garlic" },
      { name: "Jamnagar", lat: 22.4707, lng: 70.0577, odop: "Brass Components & Bandhani Fabrics" },
      { name: "Kutch", lat: 23.242, lng: 69.6669, odop: "Rann Embroidery, Kutchi Shawls & Dates" },
      { name: "Junagadh", lat: 21.5222, lng: 70.4579, odop: "Kesar Mango & Groundnut Oil" },
      { name: "Anand", lat: 22.5645, lng: 72.9289, odop: "Dairy Processing & Poultry" },
    ],
  },
  {
    state: "Rajasthan",
    districts: [
      { name: "Jaipur", lat: 26.9124, lng: 75.7873, odop: "Blue Pottery & Sanganeri Block Prints" },
      { name: "Jodhpur", lat: 26.2389, lng: 73.0243, odop: "Wooden Furniture & Handicrafts" },
      { name: "Kota", lat: 25.2138, lng: 75.8648, odop: "Kota Doria Sarees & Soya Processing" },
      { name: "Udaipur", lat: 24.5854, lng: 73.7125, odop: "Marble & Granite Processing" },
      { name: "Bikaner", lat: 28.0229, lng: 73.3119, odop: "Bikaneri Bhujia, Papads & Wool" },
      { name: "Alwar", lat: 27.553, lng: 76.6346, odop: "Mustard Oil & Milk Cake (Kalakand)" },
      { name: "Ajmer", lat: 26.4499, lng: 74.6399, odop: "Gota Patti & Rose Water (Pushkar)" },
      { name: "Bhilwara", lat: 25.3216, lng: 74.6413, odop: "Synthetic Suiting & Textile Fabric" },
    ],
  },
  {
    state: "Tamil Nadu",
    districts: [
      { name: "Chennai", lat: 13.0827, lng: 80.2707, odop: "Auto Components & Electronics" },
      { name: "Coimbatore", lat: 11.0168, lng: 76.9558, odop: "Textile Machinery & Wet Grinders" },
      { name: "Madurai", lat: 9.9252, lng: 78.1198, odop: "Madurai Jasmine (Malli) & Sungudi Sarees" },
      { name: "Tiruppur", lat: 11.1085, lng: 77.3411, odop: "Cotton Knitwear & Garment Exports" },
      { name: "Salem", lat: 11.6643, lng: 78.146, odop: "Sago Processing & Steel Fabrication" },
      { name: "Erode", lat: 11.341, lng: 77.7172, odop: "Turmeric Processing & Powerloom Textiles" },
      { name: "Tiruchirappalli", lat: 10.7905, lng: 78.7047, odop: "Banana Value Addition & Fabrication" },
      { name: "Thanjavur", lat: 10.787, lng: 79.1378, odop: "Thanjavur Art Plates & Bronze Statues" },
    ],
  },
  {
    state: "Karnataka",
    districts: [
      { name: "Bengaluru Urban", lat: 12.9716, lng: 77.5946, odop: "Electronic Hardware & Aerospace" },
      { name: "Mysuru", lat: 12.2958, lng: 76.6394, odop: "Mysore Silk, Sandalwood & Incense" },
      { name: "Belagavi", lat: 15.8497, lng: 74.4977, odop: "Hydraulics, Foundry & Sugarcane" },
      { name: "Hubballi-Dharwad", lat: 15.3647, lng: 75.124, odop: "Dharwad Peda & Cotton Ginning" },
      { name: "Shivamogga", lat: 13.9299, lng: 75.5681, odop: "Areca Nut & Pineapples" },
      { name: "Chikkamagaluru", lat: 13.3161, lng: 75.772, odop: "Arabica Coffee Processing & Spices" },
      { name: "Dakshina Kannada", lat: 12.9141, lng: 74.856, odop: "Cashew Processing & Marine Fish" },
    ],
  },
  {
    state: "Punjab",
    districts: [
      { name: "Ludhiana", lat: 30.901, lng: 75.8573, odop: "Hosiery & Woolen Garments, Cycles" },
      { name: "Amritsar", lat: 31.634, lng: 74.8723, odop: "Amritsari Papads, Warian & Shawls" },
      { name: "Jalandhar", lat: 31.326, lng: 75.5762, odop: "Sports Goods & Leather Footwear" },
      { name: "Patiala", lat: 30.3398, lng: 76.3869, odop: "Phulkari Embroidery & Punjabi Juttis" },
      { name: "Bathinda", lat: 30.211, lng: 74.9455, odop: "Cotton Processing & Thermal Logistics" },
    ],
  },
  {
    state: "Haryana",
    districts: [
      { name: "Gurugram", lat: 28.4595, lng: 77.0266, odop: "Auto Components & IT Services" },
      { name: "Faridabad", lat: 28.4089, lng: 77.3178, odop: "Tractors, Machinery & Switchgear" },
      { name: "Panipat", lat: 29.3909, lng: 76.9635, odop: "Recycled Yarn, Blankets & Handlooms" },
      { name: "Ambala", lat: 30.3782, lng: 76.7767, odop: "Scientific Laboratory Instruments" },
      { name: "Karnal", lat: 29.6857, lng: 76.9905, odop: "Basmati Rice Milling & Implements" },
    ],
  },
  {
    state: "West Bengal",
    districts: [
      { name: "Kolkata", lat: 22.5726, lng: 88.3639, odop: "Leather Goods & Jute Handloom" },
      { name: "Howrah", lat: 22.5958, lng: 88.2636, odop: "Light Engineering & Foundries" },
      { name: "Darjeeling", lat: 27.041, lng: 88.2663, odop: "Darjeeling Orthodox Tea & Tourism" },
      { name: "Murshidabad", lat: 24.1759, lng: 88.2802, odop: "Murshidabad Silk & Brass Craft" },
      { name: "Hooghly", lat: 22.903, lng: 88.3967, odop: "Jute Processing & Terracotta" },
    ],
  },
  {
    state: "Telangana",
    districts: [
      { name: "Hyderabad", lat: 17.385, lng: 78.4867, odop: "Pearls, Biryani Spices & Pharma" },
      { name: "Warangal", lat: 17.9689, lng: 79.5941, odop: "Cotton Durries & Rice Milling" },
      { name: "Karimnagar", lat: 18.4386, lng: 79.1288, odop: "Silver Filigree Work & Granite" },
      { name: "Nizamabad", lat: 18.6725, lng: 78.0941, odop: "Turmeric & Soya Processing" },
    ],
  },
  {
    state: "NCT of Delhi",
    districts: [
      { name: "Central Delhi", lat: 28.6139, lng: 77.209, odop: "Wholesale Trade & Garments" },
      { name: "South Delhi", lat: 28.5355, lng: 77.241, odop: "Fashion Design & Commerce" },
      { name: "North Delhi", lat: 28.7041, lng: 77.1025, odop: "Grain Wholesale & Plastic Molding" },
      { name: "West Delhi", lat: 28.6517, lng: 77.1235, odop: "Light Engineering & Hardware" },
      { name: "East Delhi", lat: 28.6279, lng: 77.2784, odop: "Ready-made Garments & Packaging" },
    ],
  },
];

/**
 * Find exact geographic coordinates and ODOP for any Indian District
 */
export function getDistrictGeo(districtName?: string, stateName?: string): DistrictGeo {
  if (!districtName) {
    return { name: "Pune", lat: 18.5204, lng: 73.8567, odop: "Processed Food & Agro" };
  }

  const dNorm = districtName.toLowerCase().trim();
  const sNorm = stateName?.toLowerCase().trim();

  // 1. Try matching within state first
  if (sNorm) {
    const matchedState = ALL_INDIAN_STATES_DATA.find((s) => s.state.toLowerCase() === sNorm);
    if (matchedState) {
      const match = matchedState.districts.find(
        (d) => d.name.toLowerCase() === dNorm || dNorm.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(dNorm)
      );
      if (match) return match;
    }
  }

  // 2. Search all states
  for (const st of ALL_INDIAN_STATES_DATA) {
    const match = st.districts.find(
      (d) => d.name.toLowerCase() === dNorm || dNorm.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(dNorm)
    );
    if (match) return match;
  }

  // Default fallback
  return { name: districtName, lat: 18.5204, lng: 73.8567, odop: "Regional Industrial & Commercial Trade" };
}
