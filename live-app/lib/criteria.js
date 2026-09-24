// Default Aceso Global criteria — mirrors DEFAULT_CRITERIA_STATE in
// public/final-round.js so the live search uses the same rules the
// Criteria page documents. The frontend can override this by sending its
// current (possibly edited) criteria state in the /api/search request body.

const DEFAULT_CRITERIA = {
  focusAreas: ['Health Systems Strengthening', 'Pandemic Preparedness and Response', 'Research and Evaluation', 'Policy and Capacity Building', 'Hospital Systems Management', 'Health Financing', 'Social Health Insurance', 'Innovative Service Delivery', 'Private Sector Contracting', 'Healthcare Information Systems and Technology', 'Universal Health Coverage', 'Provider Payment Systems', 'Quality of Care', 'Healthcare Efficiency', 'Public-Private Partnerships', 'Program Sustainability and Donor Transition', 'One Health', 'Nutrition'],
  activities: ['Advisory and consulting services', 'Research', 'Evaluation', 'Costing', 'Training and curriculum development', 'Capacity building', 'Strategic planning', 'Policy development', 'Program assessments', 'Service-delivery reform'],
  regions: ['Indonesia', 'Southeast Asia', 'Latin America and the Caribbean', 'Priority countries in Africa (e.g. Tanzania)'],
  fundersMDB: ['World Bank', 'IFC', 'ADB', 'IDB', 'IsDB', 'AfDB', 'AIIB'],
  fundersPhilanthropic: [],
  fundersGov: ['European Commission', 'GIZ', 'BMZ', 'Italian Development Cooperation'],
  fundersUS: ['CDC', 'U.S. Department of State'],
  budget: { min: 200000, flagLarge: true },
  languages: { english: true, spanish: true, portuguese: true, frenchReview: true },
  // Budget is a soft threshold (a review flag, never an exclusion) and closed
  // notices are dropped in server.js before scoring, so neither is listed here.
  knockouts: [
    'Restricted to individual consultants, not firms',
    'Full-time in-country presence required',
    'Local incorporation required',
    'Eligibility restricted to a country/region that excludes Aceso',
    'Education or experience requirements Aceso’s available senior team cannot satisfy',
    'Requires hiring multiple senior external specialists',
    'Work located in a conflict area',
    'Travel to a U.S. Department of State Level 4 destination',
    'Excessive focus on physical infrastructure',
    'Incompatible language requirements',
    'Procurement plan with no applicable opportunity for an international consulting firm',
    'Scope of work too vague to evaluate'
  ],
  reviewFlags: [
    'Tight submission deadline',
    'Missing or incomplete TOR/RFP',
    'Budget not published',
    'Potentially wired opportunity',
    'Unfamiliar or inconsistent funder',
    'Additional consultant required',
    'Unclear eligibility',
    'Travel required',
    'Limited information available',
    'High price weighting in the evaluation',
    'Interesting topic or country despite a low budget'
  ]
};

// Rules the UI never lets a user switch off, because they're enforced in code.
const FIXED_FLAGS = ['Clearly insufficient budget', 'Very large budget — check capacity'];
const LEGACY_RULES = ['Opportunity already closed', 'Clearly insufficient budget'];

// The frontend stores list rules as { label, enabled } and older saved states
// or the defaults use plain strings — accept both and return only active labels.
function activeLabels(list, fallback) {
  const source = Array.isArray(list) ? list : fallback || [];
  return source
    .filter((x) => typeof x === 'string' || (x && x.enabled !== false))
    .map((x) => (typeof x === 'string' ? x : x.label))
    .filter((label) => label && !LEGACY_RULES.includes(label));
}

module.exports = { DEFAULT_CRITERIA, FIXED_FLAGS, activeLabels };
