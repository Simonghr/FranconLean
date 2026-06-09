// Roller GX tag translations — exact wording from Roller's survey interface
// Fan context = "Qu'avez-vous apprécié ?" / Critic context = "Que peut-on améliorer ?"

const fan: Record<string, string> = {
  // Service
  Knowledge:       "Compétent",
  Friendliness:    "Amical",
  Helpfulness:     "Serviable",
  Consideration:   "Attentionné",
  Efficient:       "Rapide",
  Professionalism: "Professionnel",
  Patience:        "Très patient",
  // Safety
  Instructions:    "Instructions claires",
  Cleanliness:     "Propre",
  Supervision:     "Une supervision attentive",
  Hygiene:         "Hygiénique",
  Equipment:       "Un équipement sûr",
  // Facilities
  Food:            "Super offre de restauration",
  Noise:           "Pas trop bruyant",
  FacilityAge:     "Neuf et moderne",
  Maintenance:     "Bien entretenu",
  Parking:         "Stationnement facile",
  Accessibility:   "Adapté aux handicapés",
  Music:           "Super musique",
  Temperature:     "Température agréable",
  // Value
  WaitTimes:       "Délais d'attente courts",
  Capacity:        "Pas trop de monde",
  Quality:         "Expérience d'une grande qualité",
  FamilyFriendly:  "Adapté aux familles",
  Originality:     "Expérience unique",
  Variety:         "Grande variété d'activités",
}

const critic: Record<string, string> = {
  // Service
  Knowledge:       "Pas très bien informé",
  Friendliness:    "Non amical",
  Helpfulness:     "Pas serviable",
  Consideration:   "Peu attentionné",
  Efficient:       "Lent",
  Professionalism: "Manque de professionnalisme",
  Patience:        "Impatient",
  // Safety
  Instructions:    "Mauvaises instructions",
  Cleanliness:     "Sale",
  Supervision:     "Manque de supervision",
  Hygiene:         "Hygiène insuffisante",
  Equipment:       "Un équipement peu sûr",
  // Facilities
  Food:            "Offre de restauration trop limitée",
  Noise:           "Trop bruyant",
  FacilityAge:     "Pas très moderne",
  Maintenance:     "Mal entretenu",
  Parking:         "Pas de stationnement",
  Accessibility:   "Installations pour handicapés médiocres",
  Music:           "Musique inadaptée",
  Temperature:     "Trop chaud / froid",
  // Value
  WaitTimes:       "Délais d'attente longs",
  Capacity:        "Trop de monde",
  Quality:         "Mauvaise qualité",
  FamilyFriendly:  "Non adapté aux familles",
  Originality:     "Expérience pas très originale",
  Variety:         "Variété d'activités limitée",
}

export function translateTag(tag: string, isFan = true): string {
  const map = isFan ? fan : critic
  return map[tag] ?? tag
}
