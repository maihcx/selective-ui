# Selective UI Data Flow

Below is a high-level data flow diagram for Selective UI, showing how the native `<select>` element feeds models, adapters, the recycler, and the rendered DOM.

```mermaid
flowchart TD
    A[Native <select> element]
    A -->|parse DOM| B[ModelManager]
    B -->|models (GroupModel / OptionModel)| C[Adapter (MixedAdapter)]
    C -->|bind models to views| D[RecyclerView / VirtualRecyclerView]
    D -->|create/update views| E[View Layer (GroupView / OptionView)]
    E -->|render| F[DOM]

    %% Lifecycle coordination
    L[Selective.bind()] --> M[SelectBox.init()]
    M --> B
    M --> C
    M --> D
    M --> E

    %% Feedback loop
    F -->|user actions / observers| A
```

Notes:
- The `<select>` remains the single source of truth; UI reflects its state.
- ModelManager owns model creation and adapter/recycler wiring.
- Adapter handles mapping models to views and emitting change events.
- RecyclerView/VirtualRecyclerView manages efficient rendering.
