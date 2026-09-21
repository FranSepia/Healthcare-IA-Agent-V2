// Default Aceso Global criteria — mirrors DEFAULT_CRITERIA_STATE in
// public/final-round.js so the live search uses the same rules the
// Criteria page documents. The frontend can override this by sending its
// current (possibly edited) criteria state in the /api/search request body.

const DEFAULT_CRITERIA = {
  focusAreas: ['Health Systems Strengthening', 'Pandemic Preparedness and Response', 'Research and Evaluation', 'Policy and Capacity Building', 'Hospital Systems Management', 'Health Financing', 'Social Health Insurance', 'Innovative Service Delivery', 'Private Sector Contracting', 'Healthcare Information Systems and Technology', 'Universal Health Coverage', 'Provider Payment Systems', 'Quality of Care', 'Healthcare Efficiency', 'Public-Private Partnerships', 'Program Sustainability and Donor Transition', 'One Health', 'Nutrition'],
  activities: ['Advisory and consulting services', 'Research', 'Evaluation', 'Costing', 'Training and curriculum development', 'Capacity building', 'Strategic planning', 'Policy development', 'Program assessments', 'Service-delivery reform'],
  regions: ['Indonesia', 'Southeast Asia', 'Latin America and the Caribbean', 'Priority countries in Africa (e.g. Tanzania)'],
  fundersMDB: ['World Bank', 'IFC', 'ADB', 'IDB', 'IsDB', 'AfDB', 'AIIB'],
  fundersGov: ['European Commission', 'GIZ', 'BMZ', 'Italian Development Cooperation'],
  fundersUS: ['CDC', 'U.S. Department of State'],
  budget: { min: 200000, flagLarge: true },
  languages: { english: true, spanish: true, portuguese: true, frenchReview: true },
  knockouts: [
    'Restricted to individual consultants, not firms',
    'Full-time in-country presence required',
    'Local incorporation required',
    'Eligibility restricted to a country/region that excludes Aceso',
    'Work located in a conflict area',
    'Excessive focus on physical infrastructure',
    'Clearly insufficient budget',
    'Scope of work too vague to evaluate',
    'Opportunity already closed'
  ]
};

module.exports = { DEFAULT_CRITERIA };
