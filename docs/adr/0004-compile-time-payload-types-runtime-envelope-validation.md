# Compile-time payload types and runtime envelope validation

Provider packages provide compile-time event payload types and validate provider event envelopes at runtime by default, rather than fully validating every provider payload object. This avoids rejecting valid provider deliveries because of incomplete local schemas while still giving handlers typed payload ergonomics and enough runtime validation to extract event identity, event type, and provider metadata safely.
