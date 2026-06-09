import { MapPin, Users, TrendingUp } from "lucide-react"
import { mockSite } from "@/lib/mockData"

export default function SitesPage() {
  const sites = [mockSite]

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold text-white">Sites</h1>
        <p className="text-slate-400 text-sm mt-1">Gestion des sites de l'organisation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {sites.map(site => (
          <div key={site.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{site.name}</h3>
                <p className="text-sm text-slate-400">{site.address}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <Users className="w-4 h-4 text-slate-400" />
                Directeur : {site.manager_name}
              </div>
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                Actif
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
