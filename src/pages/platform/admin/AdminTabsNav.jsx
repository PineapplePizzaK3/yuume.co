import { ADMIN_TABS } from './adminTabs'

export default function AdminTabsNav({
  orderedTabs,
  activeTab,
  draggingTabId,
  setDraggingTabId,
  onTabChange,
  onTabReorder,
}) {
  return (
    <nav className="mt-6 border-b border-earth-200">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {orderedTabs.map((tabId) => {
          const tab = ADMIN_TABS.find((entry) => entry.id === tabId)
          if (!tab) return null
          return (
            <button
              key={tab.id}
              type="button"
              draggable
              onClick={() => onTabChange(tab.id)}
              onDragStart={(e) => {
                setDraggingTabId(tab.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                if (!draggingTabId || draggingTabId === tab.id) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                if (!draggingTabId || draggingTabId === tab.id) return
                e.preventDefault()
                onTabReorder(draggingTabId, tab.id)
              }}
              onDragEnd={() => setDraggingTabId('')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-earth-900 bg-earth-50 text-earth-900'
                  : 'text-earth-600 hover:bg-earth-100 hover:text-earth-800'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
