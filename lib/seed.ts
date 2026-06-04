import { supabase } from '@/lib/supabase'

const SITE_ID = '00000000-0000-0000-0000-000000000001'

export async function seedDatabase(): Promise<void> {
  // Check if site already exists
  const { data: existingSite } = await supabase.from('sites').select('id').eq('id', SITE_ID).maybeSingle()
  if (existingSite) return // Already seeded

  // 1. Insert site
  const { error: siteError } = await supabase.from('sites').insert({
    id: SITE_ID,
    name: 'Franconville',
    address: '12 Rue du Commerce, 95130 Franconville',
    manager_name: 'Simon Gohier',
  })
  if (siteError) throw siteError

  // 2. Insert 30 days of sales
  const sales = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    const target = 10000
    const variance = (Math.random() - 0.4) * 4000
    return {
      site_id: SITE_ID,
      date: date.toISOString().split('T')[0],
      amount: Math.max(8000, Math.min(15000, target + variance)),
      target,
      period: 'day' as const,
    }
  })
  const { error: salesError } = await supabase.from('sales').insert(sales)
  if (salesError) throw salesError

  // 3. Insert 10 incidents
  const now = Date.now()
  const incidents = [
    { site_id: SITE_ID, description: 'Filet trampoline endommagé zone 3 — mise hors service temporaire', category: 'quality', impact: 'high', owner: 'Thomas', status: 'in_progress', created_at: new Date(now - 2 * 86400000).toISOString() },
    { site_id: SITE_ID, description: 'Retard livraison frites — rupture stock 30 min', category: 'logistics', impact: 'medium', owner: 'Joanna', status: 'resolved', created_at: new Date(now - 3 * 86400000).toISOString(), resolved_at: new Date(now - 2 * 86400000).toISOString() },
    { site_id: SITE_ID, description: "Système caisse lent — temps d'attente augmenté", category: 'it', impact: 'medium', owner: 'Myriam', status: 'open', created_at: new Date(now - 86400000).toISOString() },
    { site_id: SITE_ID, description: "Procédure d'évacuation non respectée lors exercice", category: 'security', impact: 'high', owner: 'Simon', status: 'in_progress', created_at: new Date(now - 5 * 86400000).toISOString() },
    { site_id: SITE_ID, description: 'Client blessé légèrement sur escalier — rapport rempli', category: 'client', impact: 'high', owner: 'Clémentine', status: 'standardized', created_at: new Date(now - 8 * 86400000).toISOString(), resolved_at: new Date(now - 6 * 86400000).toISOString() },
    { site_id: SITE_ID, description: 'Musique en panne salle principale 2h', category: 'it', impact: 'low', owner: 'Thomas', status: 'resolved', created_at: new Date(now - 10 * 86400000).toISOString(), resolved_at: new Date(now - 10 * 86400000).toISOString() },
    { site_id: SITE_ID, description: "Sous-effectif samedi après-midi — files d'attente caisse", category: 'process', impact: 'medium', owner: 'Clémentine', status: 'open', created_at: new Date(now - 0.5 * 86400000).toISOString() },
    { site_id: SITE_ID, description: 'Nettoyage vestiaires insuffisant signalé par client', category: 'quality', impact: 'low', owner: 'Celia', status: 'resolved', created_at: new Date(now - 4 * 86400000).toISOString(), resolved_at: new Date(now - 3 * 86400000).toISOString() },
    { site_id: SITE_ID, description: 'Panne éclairage zone food 1h', category: 'it', impact: 'medium', owner: 'Thomas', status: 'resolved', created_at: new Date(now - 12 * 86400000).toISOString(), resolved_at: new Date(now - 12 * 86400000).toISOString() },
    { site_id: SITE_ID, description: 'Commande fournisseur erronée — sur-stock produits frais', category: 'logistics', impact: 'low', owner: 'Joanna', status: 'open', created_at: new Date(now - 6 * 86400000).toISOString() },
  ]
  const { error: incErr } = await supabase.from('incidents').insert(incidents)
  if (incErr) throw incErr

  // 4. Insert 15 customer feedbacks
  const feedbacks = [
    { site_id: SITE_ID, type: 'satisfaction', category: 'compliment', description: "Super accueil de l'équipe, les enfants ont adoré !", sentiment: 'positive', created_at: new Date(now - 86400000).toISOString() },
    { site_id: SITE_ID, type: 'complaint', category: 'quality_issue', description: 'Filet abîmé dans la zone enfants, dangereux', sentiment: 'negative', created_at: new Date(now - 2 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'complaint', category: 'service_issue', description: 'Attente trop longue à la caisse le samedi', sentiment: 'negative', created_at: new Date(now - 2 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'satisfaction', category: 'positive_experience', description: 'Animation anniversaire excellente, très professionnel', sentiment: 'positive', created_at: new Date(now - 3 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'complaint', category: 'remark', description: 'Vestiaires un peu sales en fin de journée', sentiment: 'neutral', created_at: new Date(now - 4 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'satisfaction', category: 'compliment', description: 'Personnel très sympathique et attentionné', sentiment: 'positive', created_at: new Date(now - 5 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'complaint', category: 'quality_issue', description: 'Boisson froide commandée servie à température ambiante', sentiment: 'negative', created_at: new Date(now - 6 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'satisfaction', category: 'positive_experience', description: 'Parfait pour un anniversaire, on reviendra !', sentiment: 'positive', created_at: new Date(now - 7 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'satisfaction', category: 'compliment', description: 'Animateurs très dynamiques et pros', sentiment: 'positive', created_at: new Date(now - 8 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'complaint', category: 'complaint', description: 'Trop de monde le week-end, difficile de profiter des attractions', sentiment: 'negative', created_at: new Date(now - 9 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'satisfaction', category: 'positive_experience', description: 'Tarifs raisonnables pour la qualité de la prestation', sentiment: 'positive', created_at: new Date(now - 10 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'complaint', category: 'service_issue', description: 'Pas assez de personnel en caisse à 15h le dimanche', sentiment: 'negative', created_at: new Date(now - 11 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'satisfaction', category: 'compliment', description: 'Propreté impeccable, chapeau !', sentiment: 'positive', created_at: new Date(now - 12 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'complaint', category: 'remark', description: 'Le wifi de la zone food ne fonctionnait pas', sentiment: 'neutral', created_at: new Date(now - 13 * 86400000).toISOString() },
    { site_id: SITE_ID, type: 'satisfaction', category: 'positive_experience', description: 'Excellente activité, mes enfants veulent revenir !', sentiment: 'positive', created_at: new Date(now - 14 * 86400000).toISOString() },
  ]
  const { error: fbErr } = await supabase.from('customer_feedback').insert(feedbacks)
  if (fbErr) throw fbErr

  // 5. Insert 5 kaizen ideas
  const kaizenItems = [
    { site_id: SITE_ID, author: 'Thomas', description: "Créer un système de rotation des trampolines pour éviter l'usure prématurée", estimated_gain: 3000, real_gain: 2800, status: 'implemented', created_at: new Date(now - 30 * 86400000).toISOString() },
    { site_id: SITE_ID, author: 'Myriam', description: 'Formulaire de pré-réservation en ligne pour réduire l\'attente caisse', estimated_gain: 1500, status: 'in_progress', created_at: new Date(now - 15 * 86400000).toISOString() },
    { site_id: SITE_ID, author: 'Joanna', description: "Revoir les horaires de livraison food pour coller aux pics d'affluence", estimated_gain: 800, status: 'idea', created_at: new Date(now - 7 * 86400000).toISOString() },
    { site_id: SITE_ID, author: 'Celia', description: 'Check-list nettoyage digitale avec validation par responsable de zone', estimated_gain: 500, status: 'in_progress', created_at: new Date(now - 10 * 86400000).toISOString() },
    { site_id: SITE_ID, author: 'Simon', description: "Affichage des temps d'attente estimés à l'entrée", estimated_gain: 1200, status: 'idea', created_at: new Date(now - 3 * 86400000).toISOString() },
  ]
  const { error: kzErr } = await supabase.from('kaizen').insert(kaizenItems)
  if (kzErr) throw kzErr

  // 6. Insert 3 PDCA cycles
  const pdcaItems = [
    { site_id: SITE_ID, problem: "Temps d'attente caisse > 5 min les week-ends", objective: 'Réduire le temps d\'attente à < 2 min', action: 'Ouvrir une 2e caisse dès 50 personnes présentes', result: 'Temps moyen réduit à 2.5 min', standardization: "Protocole d'ouverture 2e caisse documenté", status: 'act', created_at: new Date(now - 45 * 86400000).toISOString() },
    { site_id: SITE_ID, problem: 'Incidents de chute en zone trampoline récurrents', objective: 'Zéro incident de chute par mois', action: 'Briefing sécurité obligatoire avant saut + moniteur présent', result: "En cours d'évaluation", standardization: '', status: 'do', created_at: new Date(now - 20 * 86400000).toISOString() },
    { site_id: SITE_ID, problem: "CA food en dessous de l'objectif (-15%)", objective: 'Atteindre 20% du CA total sur le food', action: 'Formation upsell équipe + offre combo visible', result: '', standardization: '', status: 'plan', created_at: new Date(now - 5 * 86400000).toISOString() },
  ]
  const { error: pdcaErr } = await supabase.from('pdca').insert(pdcaItems)
  if (pdcaErr) throw pdcaErr
}
