/**
 * Formulário reutilizável de declaração aduaneira.
 * Pode ser usado tanto no fluxo do usuário quanto no admin.
 */
export default function CustomsDeclarationForm({
  value,
  onChange,
  disabled = false,
  required = false,
}) {
  const v = value || {}
  const set = (key, next) => onChange?.({ ...v, [key]: next })

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-earth-700">Descricao do Item</span>
        <input
          type="text"
          value={v.item_description || ''}
          onChange={(e) => set('item_description', e.target.value)}
          disabled={disabled}
          required={required}
          placeholder="Ex.: camiseta de algodao"
          className="mt-1 w-full rounded border border-earth-300 px-3 py-2 text-earth-900"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-earth-700">Valor Unitario</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={v.unit_value ?? ''}
            onChange={(e) => set('unit_value', e.target.value)}
            disabled={disabled}
            required={required}
            className="mt-1 w-full rounded border border-earth-300 px-3 py-2 text-earth-900"
          />
        </label>

        <label className="text-sm">
          <span className="text-earth-700">Quantidade</span>
          <input
            type="number"
            min="1"
            step="1"
            value={v.quantity ?? ''}
            onChange={(e) => set('quantity', e.target.value)}
            disabled={disabled}
            required={required}
            className="mt-1 w-full rounded border border-earth-300 px-3 py-2 text-earth-900"
          />
        </label>
      </div>
    </div>
  )
}
