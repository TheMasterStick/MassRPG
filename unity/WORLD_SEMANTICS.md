# World semantic layers

MassRPG deliberately separates semantic geography from storage geography.

Storage pages and render chunks answer technical questions such as "what data should be loaded?" They do **not** define regions, kingdoms, biomes, creature areas or POIs.

Semantic areas are arbitrary shapes and may overlap freely. A single tile can simultaneously belong to Emberwatch Region, a forest biome, a level band, a kingdom territory, a wolf population area and a no-build zone. The editor therefore works with independent area layers rather than forcing the world into one exclusive region hierarchy.

Normal authored POIs (capital, towns, villages, settlements, dungeon entrances, mines, ruins, shrines, docks, bridges, landmarks, etc.) are public map information by default. Hidden locations explicitly opt into hidden visibility. Creature spawn areas and resource-distribution areas are simulation/editor data and are not public map overlays merely because they exist.

A POI's visible footprint is independent from its protection/no-build footprint. Minor locations can use circles; important locations can use precise polygons. Roads are public authored polylines and remain normal travel/navigation infrastructure, not fast travel.
