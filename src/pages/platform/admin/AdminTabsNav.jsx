import { ADMIN_TAB_CATEGORIES, ADMIN_TABS, getAdminCategoryByTabId } from './adminTabs'

export default function AdminTabsNav({
  orderedTabs,
  activeTab,
  draggingTabId,
  setDraggingTabId,
  onTabChange,
  onTabReorder,
}) {
  const orderedCategoryIds = []
  const tabsByCategory = {}
  for (const tabId of orderedTabs) {
    const tab = ADMIN_TABS.find((entry) => entry.id === tabId)
    if (!tab) continue
    const categoryId = tab.category || getAdminCategoryByTabId(tab.id)
    if (!tabsByCategory[categoryId]) {
      tabsByCategory[categoryId] = []
      orderedCategoryIds.push(categoryId)
    }
    tabsByCategory[categoryId].push(tab)
  }
  const activeCategory = getAdminCategoryByTabId(activeTab)

  return (
    <nav className="mt-6 border-b border-earth-200">
      <div className="flex gap-1 overflow-x-auto pb-2">
        {orderedCategoryIds.map((categoryId) => {
          const categoryMeta = ADMIN_TAB_CATEGORIES.find((cat) => cat.id === categoryId)
          return (
            <button
              key={categoryId}
              type="button"
              onClick={() => {
                const firstTab = tabsByCategory[categoryId]?.[0]
                if (firstTab) onTabChange(firstTab.id)
              }}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeCategory === categoryId
                  ? 'bg-earth-900 text-white'
                  : 'bg-earth-100 text-earth-700 hover:bg-earth-200'
              }`}
            >
              <span>{categoryMeta?.icon || '•'}</span>
              {categoryMeta?.label || categoryId}
            </button>
          )
        })}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {(tabsByCategory[activeCategory] || []).map((tab) => {
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
