/**
 * TerraSync Seed Data
 * Realistic data modeled around a crop consultant's account book
 */
window.TerraSyncData = {
  // The logged-in consultant
  consultant: {
    name: 'Mike Reynolds',
    title: 'Senior Crop Consultant',
    company: 'Prairie AgriServices',
    phone: '(515) 220-4488',
    license: 'CCA #IA-20194'
  },

  growers: [
    {
      id: 'g-1',
      name: 'Maple Creek Farms',
      contactName: 'James Henderson',
      phone: '(515) 555-0142',
      email: 'james@maplecreek.com',
      address: '4521 County Road 180, Boone, IA 50036',
      totalAcreage: 280,
      status: 'Active',
      accountSince: '2019',
      lastVisit: '2026-07-10',
      notes: 'Prefers early morning visits. Has been dealing with aphid pressure this season.'
    },
    {
      id: 'g-2',
      name: 'Oakridge Growers',
      contactName: 'Sarah Jenkins',
      phone: '(515) 555-0197',
      email: 'sarah@oakridgegrowers.net',
      address: '8912 Highway 30 West, Nevada, IA 50201',
      totalAcreage: 340,
      status: 'Active',
      accountSince: '2021',
      lastVisit: '2026-07-14',
      notes: 'New customer, transitioning from conventional to no-till.'
    },
    {
      id: 'g-3',
      name: 'Benton Agricultural Group',
      contactName: 'Robert Benton',
      phone: '(515) 555-0213',
      email: 'robert@bentongroup.com',
      address: '1103 West Lincoln Way, Gilbert, IA 50105',
      totalAcreage: 560,
      status: 'Review Needed',
      accountSince: '2018',
      lastVisit: '2026-07-08',
      notes: 'Largest account. Multiple operators. Robert handles purchasing decisions.'
    }
  ],

  fields: [
    {
      id: 'f-101', growerId: 'g-1', name: 'Home Creek South',
      crop: 'Corn', variety: 'Pioneer P0621AM', cropStage: 'V6 (Vegetative)',
      plantDate: '2026-04-22', acreage: 120, soilType: 'Webster Silty Clay Loam',
      ndvi: 0.76, previousCrop: 'Soybeans',
      polygon: [[42.0250,-93.6580],[42.0290,-93.6580],[42.0290,-93.6520],[42.0250,-93.6520]],
      scoutingHistory: [
        { id: 'sc-1', date: '2026-07-10', issue: 'Aphids', category: 'Insects', severity: 'Medium', lat: 42.0270, lng: -93.6550, note: 'Early sign of soybean aphids on leaves — 50-80 per plant on field edges. Below threshold but needs monitoring next visit.', actionTaken: 'Monitoring' },
        { id: 'sc-2', date: '2026-07-10', issue: 'Nitrogen Deficiency', category: 'Nutrient', severity: 'High', lat: 42.0282, lng: -93.6535, note: 'Yellowing at leaf tips in lower canopy, V-shaped pattern. Likely late-season N loss from June rainfall. Side-dress application recommended.', actionTaken: 'Recommendation created' }
      ],
      charts: { soilMoisture: [38,36,32,28,30,27,25], npk: { N: 38, P: 44, K: 32 }, ndviHistory: [0.45,0.52,0.61,0.70,0.74,0.76] }
    },
    {
      id: 'f-102', growerId: 'g-1', name: 'East Section 4',
      crop: 'Soybeans', variety: 'Asgrow AG27XF1', cropStage: 'R1 (Beginning Bloom)',
      plantDate: '2026-05-08', acreage: 160, soilType: 'Clarion Loam',
      ndvi: 0.82, previousCrop: 'Corn',
      polygon: [[42.0300,-93.6420],[42.0340,-93.6420],[42.0340,-93.6360],[42.0300,-93.6360]],
      scoutingHistory: [
        { id: 'sc-3', date: '2026-07-10', issue: 'Waterhemp Escape', category: 'Weeds', severity: 'Low', lat: 42.0320, lng: -93.6390, note: 'Scattered waterhemp escapes in northeast corner, 3-5 inches tall. Hand-pull or spot-spray recommended before seed set.', actionTaken: 'Spot treatment advised' }
      ],
      charts: { soilMoisture: [42,40,39,37,36,34,33], npk: { N: 55, P: 38, K: 41 }, ndviHistory: [0.38,0.46,0.55,0.68,0.78,0.82] }
    },
    {
      id: 'f-201', growerId: 'g-2', name: 'Highway Corner',
      crop: 'Corn', variety: 'DeKalb DKC62-08', cropStage: 'V8 (Vegetative)',
      plantDate: '2026-04-28', acreage: 180, soilType: 'Canisteo Clay Loam',
      ndvi: 0.68, previousCrop: 'Corn',
      polygon: [[42.0180,-93.6500],[42.0220,-93.6500],[42.0220,-93.6440],[42.0180,-93.6440]],
      scoutingHistory: [
        { id: 'sc-4', date: '2026-07-14', issue: 'Ponding / Waterlogging', category: 'Environmental', severity: 'High', lat: 42.0205, lng: -93.6465, note: 'Standing water in 3 low spots from Monday heavy rain (~2.5"). Corn showing wilting symptoms. Roots may be oxygen-starved. Monitor for recovery.', actionTaken: 'Monitoring — flag for drainage tile quote' }
      ],
      charts: { soilMoisture: [48,52,54,51,48,45,42], npk: { N: 25, P: 29, K: 30 }, ndviHistory: [0.42,0.50,0.58,0.63,0.67,0.68] }
    },
    {
      id: 'f-202', growerId: 'g-2', name: 'River Bend West',
      crop: 'Wheat', variety: 'WestBred WB4303', cropStage: 'Feekes 10.5 (Heading)',
      plantDate: '2026-03-15', acreage: 160, soilType: 'Nicollet Sandy Loam',
      ndvi: 0.88, previousCrop: 'Soybeans',
      polygon: [[42.0120,-93.6660],[42.0160,-93.6660],[42.0160,-93.6600],[42.0120,-93.6600]],
      scoutingHistory: [],
      charts: { soilMoisture: [32,31,30,28,29,27,26], npk: { N: 62, P: 48, K: 50 }, ndviHistory: [0.50,0.62,0.75,0.83,0.87,0.88] }
    },
    {
      id: 'f-301', growerId: 'g-3', name: 'North Prairie 40',
      crop: 'Corn', variety: 'Pioneer P1093AM', cropStage: 'V10 (Vegetative)',
      plantDate: '2026-04-18', acreage: 240, soilType: 'Harps Clay Loam',
      ndvi: 0.72, previousCrop: 'Corn',
      polygon: [[42.0350,-93.6350],[42.0390,-93.6350],[42.0390,-93.6280],[42.0350,-93.6280]],
      scoutingHistory: [
        { id: 'sc-5', date: '2026-07-08', issue: 'Gray Leaf Spot', category: 'Disease', severity: 'Medium', lat: 42.0365, lng: -93.6320, note: 'GLS lesions forming on lower canopy (leaves 3-4). Corn-on-corn field — expected. Fungicide application recommended at VT if lesions progress above ear leaf.', actionTaken: 'Pre-scheduled fungicide at VT' },
        { id: 'sc-6', date: '2026-07-08', issue: 'Rootworm Damage', category: 'Insects', severity: 'High', lat: 42.0375, lng: -93.6300, note: 'Lodging in rows 12-18. Root dig confirms pruning to 1 node. Corn-on-corn with no Bt rootworm trait. Need to discuss rotation or trait package for next season.', actionTaken: 'Season follow-up discussion' }
      ],
      charts: { soilMoisture: [35,33,31,29,28,30,28], npk: { N: 42, P: 36, K: 28 }, ndviHistory: [0.40,0.48,0.56,0.65,0.70,0.72] }
    },
    {
      id: 'f-302', growerId: 'g-3', name: 'South Bottoms',
      crop: 'Soybeans', variety: 'Asgrow AG32XF2', cropStage: 'R3 (Beginning Pod)',
      plantDate: '2026-05-05', acreage: 200, soilType: 'Okoboji Silty Clay',
      ndvi: 0.85, previousCrop: 'Corn',
      polygon: [[42.0080,-93.6550],[42.0120,-93.6550],[42.0120,-93.6480],[42.0080,-93.6480]],
      scoutingHistory: [
        { id: 'sc-7', date: '2026-07-08', issue: 'Iron Deficiency Chlorosis', category: 'Nutrient', severity: 'Low', lat: 42.0100, lng: -93.6515, note: 'Mild interveinal yellowing on calcareous knoll. IDC score 2. Cosmetic only at R3, plants growing through it. Note for variety selection next year.', actionTaken: 'No action — document for next year variety planning' }
      ],
      charts: { soilMoisture: [40,38,37,36,35,34,33], npk: { N: 48, P: 52, K: 45 }, ndviHistory: [0.35,0.45,0.58,0.72,0.80,0.85] }
    },
    {
      id: 'f-303', growerId: 'g-3', name: 'Windmill Terrace',
      crop: 'Wheat', variety: 'SY Wolverine', cropStage: 'Feekes 11.1 (Ripening)',
      plantDate: '2026-03-10', acreage: 120, soilType: 'Clarion-Nicollet Complex',
      ndvi: 0.65, previousCrop: 'Soybeans',
      polygon: [[42.0200,-93.6700],[42.0240,-93.6700],[42.0240,-93.6640],[42.0200,-93.6640]],
      scoutingHistory: [],
      charts: { soilMoisture: [25,24,22,20,21,20,19], npk: { N: 30, P: 42, K: 55 }, ndviHistory: [0.55,0.65,0.72,0.70,0.67,0.65] }
    }
  ],

  // Common scouting issue categories for the "Add Observation" form
  scoutingCategories: [
    { value: 'Insects', label: 'Insects / Pests', icon: '🐛' },
    { value: 'Disease', label: 'Disease / Pathogen', icon: '🦠' },
    { value: 'Weeds', label: 'Weed Pressure', icon: '🌿' },
    { value: 'Nutrient', label: 'Nutrient Deficiency', icon: '🧪' },
    { value: 'Environmental', label: 'Environmental / Weather', icon: '🌧️' },
    { value: 'StandCount', label: 'Stand / Population', icon: '🌱' },
    { value: 'Equipment', label: 'Equipment Damage', icon: '🚜' },
    { value: 'Other', label: 'Other', icon: '📋' }
  ],

  severityLevels: [
    { value: 'Low', label: 'Low — Monitor', color: '#10b981' },
    { value: 'Medium', label: 'Medium — Action Needed', color: '#f59e0b' },
    { value: 'High', label: 'High — Urgent', color: '#ef4444' }
  ],

  products: {
    fertilizers: [
      { id: 'prod-f1', name: 'Urea (46-0-0)', pricePerUnit: 520, unit: 'Ton' },
      { id: 'prod-f2', name: 'DAP (18-46-0)', pricePerUnit: 680, unit: 'Ton' },
      { id: 'prod-f3', name: 'Potash (0-0-60)', pricePerUnit: 590, unit: 'Ton' },
      { id: 'prod-f4', name: 'Anhydrous Ammonia (82-0-0)', pricePerUnit: 850, unit: 'Ton' },
      { id: 'prod-f5', name: 'AMS (21-0-0-24S)', pricePerUnit: 380, unit: 'Ton' },
      { id: 'prod-f6', name: '28% UAN Solution', pricePerUnit: 320, unit: 'Ton' }
    ],
    chemicals: [
      { id: 'prod-c1', name: 'Roundup PowerMAX (Glyphosate)', pricePerUnit: 48, unit: 'Gallon' },
      { id: 'prod-c2', name: 'Acuron Flexi (Pre-emerge)', pricePerUnit: 62, unit: 'Gallon' },
      { id: 'prod-c3', name: 'Headline AMP (Fungicide)', pricePerUnit: 145, unit: 'Gallon' },
      { id: 'prod-c4', name: 'Warrior II (Insecticide)', pricePerUnit: 95, unit: 'Gallon' },
      { id: 'prod-c5', name: 'Trivapro (Fungicide)', pricePerUnit: 165, unit: 'Gallon' },
      { id: 'prod-c6', name: 'Transform WG (Aphicide)', pricePerUnit: 210, unit: 'Pound' },
      { id: 'prod-c7', name: 'Engenia (Dicamba)', pricePerUnit: 78, unit: 'Gallon' }
    ],
    seeds: [
      { id: 'prod-s1', name: 'Pioneer P0621AM (Corn)', pricePerUnit: 290, unit: 'Bag' },
      { id: 'prod-s2', name: 'Asgrow AG27XF1 (Soybean)', pricePerUnit: 74, unit: 'Bag' },
      { id: 'prod-s3', name: 'WestBred WB4303 (Wheat)', pricePerUnit: 42, unit: 'Bag' },
      { id: 'prod-s4', name: 'DeKalb DKC62-08 (Corn)', pricePerUnit: 285, unit: 'Bag' }
    ]
  }
};

