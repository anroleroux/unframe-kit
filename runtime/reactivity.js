function reactive(obj, onChange) {
    return new Proxy(obj, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);

            if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
                return value;
            }
            
            if (typeof value === 'object' && value !== null)
                return reactive(value, onChange);
            return value;
        },
        set(target, prop, value, receiver) {
            const result = Reflect.set(target, prop, value, receiver);
            if (prop !== "_draft") {
                onChange();
            }
            return result;
        },
        deleteProperty(target, prop) {
            const result = Reflect.deleteProperty(target, prop);
            onChange();
            return result;
        }
    });
}

function mount(root, state, template) {
    function bindEditableInputs() {
        document.querySelectorAll("input[id^='input-']").forEach(input => {
            input.oninput = e => {
                const [ , nindex, field ] = input.id.split("-");
                networks[nindex]._draft = e.target.value;
            };
            input.focus();
        });
    }

    function render() {
        root.innerHTML = template(state);
        bindEditableInputs();
    }
    
    const r = reactive(state, render);
    render();
    return r;
}

// Renders a display row (label + value + edit button) or, when this field is
// being edited, an edit row (label + input/select + Save/Cancel buttons).
// mountRef  — global variable name of the reactive mount object, e.g. 'products'
// apiPath   — base API path for PATCH, e.g. '/api/products'
// label     — human-readable field label shown above the input
// fieldKey  — property name on the selected item, e.g. 'name', 'price'
// display   — formatted string shown in display mode, e.g. '$3.49'
// inputType — 'text' | 'number' | 'select'
// options   — required when inputType === 'select': [{value, label}, ...]
function editableField(mountRef, apiPath, label, fieldKey, display, inputType, options) {
    const mount = window[mountRef];
    if (mount.editing_field === fieldKey) {
        const control = inputType === 'select'
            ? `<select class="editable-field__input" onchange="${mountRef}._draft=this.value">
                   ${options.map(o => `<option value="${o.value}"${o.value == mount._draft ? ' selected' : ''}>${o.label}</option>`).join('')}
               </select>`
            : `<input class="editable-field__input" type="${inputType}" value="${mount._draft ?? ''}" oninput="${mountRef}._draft=this.value"${inputType === 'number' ? ' step="any" min="0"' : ''}>`;
        return `
            <div class="editable-field editable-field--editing">
                <label class="editable-field__label">${label}</label>
                ${control}
                <div class="editable-field__btns">
                    <button class="save-field-btn" type="button" onclick="saveField('${mountRef}','${fieldKey}','${apiPath}','${inputType}')">Save</button>
                    <button class="cancel-field-btn" type="button" onclick="cancelEdit('${mountRef}')">Cancel</button>
                </div>
            </div>`;
    }
    return `
        <div class="editable-field">
            <label class="editable-field__label">${label}</label>
            <span class="editable-field__value">${display}</span>
            <button class="edit-field-btn" type="button" onclick="beginEdit('${mountRef}','${fieldKey}')">&#9998;</button>
        </div>`;
}

// Seeds _draft with the current field value (no re-render) then sets
// editing_field (triggers one re-render that switches the field to edit mode).
// mountRef — global variable name of the reactive mount object
// fieldKey — property name on the selected item to begin editing
function beginEdit(mountRef, fieldKey) {
    const mount = window[mountRef];
    mount._draft = mount.selected[fieldKey];
    mount.editing_field = fieldKey;
}

// Clears editing_field, reverting the active field back to display mode.
// mountRef — global variable name of the reactive mount object
function cancelEdit(mountRef) {
    window[mountRef].editing_field = null;
}

// Reads _draft, type-converts it based on inputType, PATCHes the API (online
// builds only), writes the value back to the selected item, persists the list
// locally, and clears editing_field.
// mountRef  — global variable name of the reactive mount object
// fieldKey  — property name on the selected item being saved
// apiPath   — base API path; request goes to apiPath/selected.id
// inputType — 'text' | 'number' | 'select'; controls type conversion of _draft
function saveField(mountRef, fieldKey, apiPath, inputType) {
    const mount = window[mountRef];
    let val = mount._draft;
    if (inputType === 'number') val = parseFloat(val) || 0;
    if (inputType === 'select') val = parseInt(val, 10);

    //online-start
    fetch(`${apiPath}/${mount.selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldKey]: val }),
    }).catch(() => alert("Could not save changes."));
    //online-end

    mount.selected[fieldKey] = val;
    saveLocal(mountRef, mount.list);
    mount.editing_field = null;
}