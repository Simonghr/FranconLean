// Roller GX tag translations (EN → FR)
// serviceRatingReasons, safetyRatingReasons, facilitiesRatingReasons, valueRatingReasons

const translations: Record<string, string> = {
  // Service
  Knowledge:        "Connaissance",
  Friendly:         "Amabilité",
  Helpful:          "Serviabilité",
  Attentive:        "Attention",
  Professional:     "Professionnalisme",
  Responsive:       "Réactivité",
  Welcoming:        "Accueil",
  Communication:    "Communication",

  // Safety
  Instructions:     "Instructions",
  Hygiene:          "Hygiène",
  Equipment:        "Équipement",
  Supervision:      "Surveillance",
  Cleanliness:      "Propreté",
  Safety:           "Sécurité",

  // Facilities
  Food:             "Restauration",
  Parking:          "Parking",
  Facilities:       "Installations",
  Atmosphere:       "Ambiance",
  Accessibility:    "Accessibilité",
  Signage:          "Signalétique",
  Toilets:          "Sanitaires",
  Seating:          "Sièges",
  Music:            "Musique",

  // Value
  Capacity:         "Capacité",
  Quality:          "Qualité",
  FamilyFriendly:   "Famille",
  Price:            "Prix",
  Value:            "Rapport qualité/prix",
  Variety:          "Variété",
  Duration:         "Durée",
  Waiting:          "Attente",
  WaitTime:         "Temps d'attente",
  Booking:          "Réservation",
}

export function translateTag(tag: string): string {
  return translations[tag] ?? tag
}
