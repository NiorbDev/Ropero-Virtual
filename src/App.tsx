import { BackgroundMusic } from "./components/BackgroundMusic";
import { setUiLanguage, useUiText } from "./ui-language";
import { RoperoSelect } from "./components/RoperoSelect";
import { BrandIcon } from "./components/BrandIcon";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Fit,
  Garment,
  GarmentCategory,
  GarmentAvailability,
  GarmentMeasurements,
  GarmentPhotoAsset,
  Outfit,
  OutfitCanvasLayout,
  Profile,
  WearEntry,
} from "./core/entities";
import { deleteGarment } from "./core/wardrobe-lifecycle";
import { ItemActions } from "./components/ItemActions";
import { GarmentPhotoPicker } from "./components/GarmentPhotoPicker";
import {
  categoryForGarmentType,
  garmentTypeGroups,
  garmentTypeOptions,
} from "./core/garment-types";
import {
  emptyGarmentFilters,
  filterGarments,
  hasActiveGarmentFilters,
  type GarmentFilters,
} from "./core/garment-filters";
import { addCanvasGarment, createDefaultLayout } from "./core/outfit-canvas";
import { createMemoryRepository } from "./data/memory-repository";
import {
  createLocalStorageStateStore,
  readLocalStateSnapshot,
  type AppStateStore,
  type SavedState,
} from "./data/app-state-store";
import { createAppStorage, type AppStorage } from "./data/create-app-storage";
import { createWebPhotoStore, type PhotoStore } from "./data/photo-store";
import { BackgroundRemovalService } from "./services/background-removal";
import { createOutfitService } from "./services/outfit-service";
import { createProfileService } from "./services/profile-service";
import { createWardrobeService } from "./services/wardrobe-service";
import { OutfitCarousel } from "./components/outfit-studio/OutfitCarousel";
import { PhotoCutoutEditor } from "./components/photo-editor/PhotoCutoutEditor";
import { WardrobeTransfer } from "./components/WardrobeTransfer";
import { WardrobeTutorial } from "./components/WardrobeTutorial";
import "./App.css";
import "./inventory-import.css";
import "./catalog.css";
import "./responsive-studio.css";
import "./chocolate-sakura.css";
import "./wardrobe-management.css";

const categories: Array<{
  value: GarmentCategory;
  label: string;

}> = [
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Partes de abajo" },
  { value: "dress-skirt", label: "Vestidos y faldas" },
  { value: "outerwear", label: "Abrigos" },
  { value: "footwear", label: "Calzado" },
  { value: "accessory", label: "Accesorios" },
];
function singleWardrobe(state: SavedState, preferredId?: string): SavedState {
  const profile = state.profiles.find((item) => item.id === preferredId) ?? state.profiles[0];
  if (!profile || state.profiles.length < 2) return state;
  return {
    ...state,
    profiles: [profile],
    garments: state.garments.map((item) => ({ ...item, profileId: profile.id })),
    outfits: state.outfits.map((item) => ({ ...item, profileId: profile.id })),
    wearHistory: state.wearHistory?.map((item) => ({ ...item, profileId: profile.id })),
    selectedGarmentIdsByProfile: {
      [profile.id]: [...new Set(Object.values(state.selectedGarmentIdsByProfile).flat())],
    },
  };
}

type Section = "studio" | "wardrobe" | "outfits" | "settings";

interface PhotoEditorDraft {
  assetId: string;
  original: Blob;
  cutout: Blob | null;
}

interface PhotoProcessStatus {
  progress: number;
  error: string;
}

function categoryFor(category: GarmentCategory) {
  return categories.find((item) => item.value === category)!;
}

const languageOptions = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
] as const;
type Language = typeof languageOptions[number]["value"];
const languageKey = "ropero-language";
const navigationLabels = {
  es: { studio: "Probador 2D", wardrobe: "Mi ropero", outfits: "Conjuntos", settings: "Ajustes", language: "Idioma" },
  en: { studio: "2D fitting room", wardrobe: "My wardrobe", outfits: "Outfits", settings: "Settings", language: "Language" },
  pt: { studio: "Provador 2D", wardrobe: "Meu guarda-roupa", outfits: "Looks", settings: "Configurações", language: "Idioma" },
};

function App() {
  const ui = useUiText();
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(languageKey);
      return stored === "en" || stored === "pt" ? stored : "es";
    } catch {
      return "es";
    }
  });
  const navigation = navigationLabels[language];
  useEffect(() => {
    setUiLanguage(language);
    try { localStorage.setItem(languageKey, language); } catch { /* Keep the selection for this session. */ }
  }, [language]);
  const repository = useMemo(createMemoryRepository, []);
  const profilesService = useMemo(
    () => createProfileService(repository),
    [repository],
  );
  const wardrobeService = useMemo(
    () => createWardrobeService(repository),
    [repository],
  );
  const outfitService = useMemo(
    () => createOutfitService(repository),
    [repository],
  );
  const [saved] = useState(readLocalStateSnapshot);
  const [fallbackStorage] = useState<AppStorage>(() => ({
    stateStore: createLocalStorageStateStore(),
    photoStore: createWebPhotoStore(),
    initializationWarning: null,
  }));
  const nativeRuntime = useMemo(isTauri, []);
  const stateStoreRef = useRef<AppStateStore>(fallbackStorage.stateStore);
  const storageRef = useRef<AppStorage>(fallbackStorage);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const skipInitialNativeSaveRef = useRef(false);
  const backgroundRemovalRef = useRef<BackgroundRemovalService | null>(null);
  const [storageReady, setStorageReady] = useState(!nativeRuntime);
  const [persistenceStatus, setPersistenceStatus] = useState(
    nativeRuntime ? ui("Preparando almacenamiento seguro…") : ui("Guardado local listo"),
  );
  const [initializationWarning, setInitializationWarning] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const persistenceWarning = saveWarning || initializationWarning;
  const [allProfiles, setAllProfiles] = useState(saved.profiles);
  const [garments, setGarments] = useState(saved.garments);
  const [outfits, setOutfits] = useState(saved.outfits);
  const [wearHistory, setWearHistory] = useState<WearEntry[]>(saved.wearHistory ?? []);
  const [actionMessage, setActionMessage] = useState('');
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [section, setSection] = useState<Section>("studio");
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [section]);
  const [showGarmentForm, setShowGarmentForm] = useState(false);
  const [garmentName, setGarmentName] = useState("");
  const [category, setCategory] = useState<GarmentCategory>("top");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [fit, setFit] = useState<Fit>("regular");
  const [seasons, setSeasons] = useState("");
  const [styles, setStyles] = useState("");
  const [photoAssets, setPhotoAssets] = useState<GarmentPhotoAsset[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [photoProcessing, setPhotoProcessing] = useState<Record<string, PhotoProcessStatus>>({});
  const [photoEditor, setPhotoEditor] = useState<PhotoEditorDraft | null>(null);
  const [customTypes, setCustomTypes] = useState<Array<{ value: string; label: string; category: GarmentCategory }>>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("ropero-custom-types") ?? "[]");
      return Array.isArray(stored) ? stored.filter(item => typeof item?.value === "string"
        && typeof item.label === "string" && garmentTypeGroups.some(group =>
          group.options.some(option => option.category === item.category))) : [];
    } catch { return []; }
  });
  const [garmentEditRequest, setGarmentEditRequest] = useState(0);
  const [editingGarment, setEditingGarment] = useState<Garment | null>(null);
  const [filters, setFilters] = useState<GarmentFilters>(emptyGarmentFilters);
  const [subtype, setSubtype] = useState("polera");
  const [description, setDescription] = useState("");
  const [availability, setAvailability] = useState<GarmentAvailability>("available");
  const [measurements, setMeasurements] = useState<GarmentMeasurements>({ length: "regular", width: "regular", sleeve: "long" });
  const [outfitName, setOutfitName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGarmentIdsByProfile, setSelectedGarmentIdsByProfile] =
    useState(saved.selectedGarmentIdsByProfile);
  const [photoStore, setPhotoStore] = useState<PhotoStore>(fallbackStorage.photoStore);
  const [activeOutfitId, setActiveOutfitId] = useState<string | null>(null);
  const [studioLayout, setStudioLayout] = useState<OutfitCanvasLayout>({
    items: [],
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const storage = await createAppStorage();
        const loaded = await storage.stateStore.load(saved);
        if (cancelled) return;

        stateStoreRef.current = storage.stateStore;
        storageRef.current = storage;
        // A native legacy/future-schema/damaged fallback is intentionally read-only
        // until the person makes a real change. Saving it here would overwrite the
        // protected SQLite row with the local fallback snapshot.
        skipInitialNativeSaveRef.current = nativeRuntime
          && !storage.initializationWarning
          && loaded.source === "legacy";
        setPhotoStore(storage.photoStore);
        const state = singleWardrobe(loaded.state);
        setAllProfiles(state.profiles);
        setGarments(state.garments);
        setOutfits(state.outfits);
        setWearHistory(state.wearHistory ?? []);
        setSelectedGarmentIdsByProfile(state.selectedGarmentIdsByProfile);
        setActiveProfile(state.profiles[0] ?? null);
        setInitializationWarning(storage.initializationWarning ?? loaded.warning ?? "");
        setPersistenceStatus((current) => current.startsWith("Guardado en este equipo")
          ? current
          : nativeRuntime && loaded.source === "primary" ? "SQLite listo" : ui("Guardado local listo"));
      } catch {
        setInitializationWarning(
          "No se pudo iniciar el almacenamiento nativo; el ropero seguirá disponible en modo local.",
        );
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nativeRuntime, saved]);

  useEffect(() => () => {
    backgroundRemovalRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (skipInitialNativeSaveRef.current) {
      skipInitialNativeSaveRef.current = false;
      return;
    }

    const state: SavedState = {
      profiles: allProfiles,
      garments,
      outfits,
      selectedGarmentIdsByProfile,
      wearHistory,
    };
    let current = true;
    const saveAttempt = saveQueueRef.current.then(() => stateStoreRef.current.save(state));
    saveQueueRef.current = saveAttempt.catch(() => undefined);
    void saveAttempt.then(
      () => {
        if (current) {
          setSaveWarning("");
          setPersistenceStatus(ui("Guardado en este equipo ✓"));
        }
      },
      () => {
        if (current) {
          setSaveWarning(
            "No se pudo guardar el último cambio. El ropero sigue abierto para que no pierdas el trabajo actual.",
          );
        }
      },
    );

    return () => {
      current = false;
    };
  }, [storageReady, allProfiles, garments, outfits, selectedGarmentIdsByProfile, wearHistory]);
  const activeProfileId = activeProfile?.id;
  const profileGarments = useMemo(
    () => activeProfileId ? garments.filter((garment) => garment.profileId === activeProfileId) : [],
    [garments, activeProfileId],
  );
  const profileOutfits = useMemo(
    () => activeProfileId ? outfits.filter((outfit) => outfit.profileId === activeProfileId) : [],
    [outfits, activeProfileId],
  );
  const availableGarments = useMemo(
    () => profileGarments.filter((garment) => !garment.archivedAt),
    [profileGarments],
  );
  const availableOutfits = useMemo(
    () => profileOutfits.filter((outfit) => !outfit.archivedAt),
    [profileOutfits],
  );

  function createProfile() {
    if (!profileName.trim()) return;
    const profile = profilesService.create(profileName);
    setAllProfiles((items) => [...items, profile]);
    chooseProfile(profile);
    setProfileName("");
  }
  function chooseProfile(profile: Profile) {
    cancelGarmentForm();
    setPhotoEditor(null);
    setActionMessage('');
    setActiveProfile(profile);
    setSection("studio");
    setSelectedIds([]);
    setActiveOutfitId(null);
    setStudioLayout({ items: [], updatedAt: new Date().toISOString() });
  }
  async function addPhotos(files: File[], openEditor = false) {
    if (files.length === 0) return;
    try {
      const references = await photoStore.saveFiles(files);
      const createdAt = new Date().toISOString();
      const assets = references.map((originalRef) => ({
        id: crypto.randomUUID(),
        originalRef,
        cutoutRef: null,
        createdAt,
      }));
      setPhotoAssets((current) => [...current, ...assets]);
      if (openEditor && assets[0]) setPhotoEditor({ assetId: assets[0].id, original: files[0], cutout: null });
      setPhotoError("");
    } catch (error) {
      setPhotoError(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar las fotos.",
      );
    }
  }
  function updatePhotoAsset(
    assetId: string,
    update: (asset: GarmentPhotoAsset) => GarmentPhotoAsset,
  ) {
    setPhotoAssets((current) => current.map((asset) => asset.id === assetId ? update(asset) : asset));
  }
  async function removePhotoBackground(assetId: string, openEditor = false) {
    const asset = photoAssets.find((item) => item.id === assetId);
    if (!asset) return;
    setPhotoProcessing((current) => ({ ...current, [assetId]: { progress: 0, error: "" } }));
    try {
      const original = await photoStore.readBlob(asset.originalRef);
      const service = backgroundRemovalRef.current ?? new BackgroundRemovalService();
      backgroundRemovalRef.current = service;
      const cutout = await service.remove(original, (progress) => {
        setPhotoProcessing((current) => ({ ...current, [assetId]: { progress: Math.min(0.99, progress), error: "" } }));
      });
      const cutoutRef = await photoStore.saveBlob(cutout, `${asset.id}-cutout.png`);
      updatePhotoAsset(assetId, (current) => ({ ...current, cutoutRef }));
      if (openEditor) setPhotoEditor({ assetId, original, cutout });
      setPhotoProcessing((current) => ({ ...current, [assetId]: { progress: 1, error: "" } }));
    } catch (reason) {
      const detail = reason instanceof Error && reason.message
        ? ` Detalle: ${reason.message}`
        : "";
      setPhotoProcessing((current) => ({
        ...current,
        [assetId]: {
          progress: 0,
          error: `No se pudo quitar el fondo automáticamente. Tu foto original está a salvo.${detail}`,
        },
      }));
    }
  }
  async function openPhotoEditor(assetId: string) {
    const asset = photoAssets.find((item) => item.id === assetId);
    if (!asset) return;
    try {
      const [original, cutout] = await Promise.all([
        photoStore.readBlob(asset.originalRef),
        asset.cutoutRef ? photoStore.readBlob(asset.cutoutRef) : Promise.resolve(null),
      ]);
      setPhotoEditor({ assetId, original, cutout });
      setPhotoError("");
    } catch {
      setPhotoError("No se pudo abrir esta foto para ajustar el recorte.");
    }
  }
  function useOriginalPhoto(assetId: string) {
    updatePhotoAsset(assetId, (asset) => ({ ...asset, cutoutRef: null }));
    setPhotoProcessing((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
  }
  async function acceptManualCutout(blob: Blob) {
    if (!photoEditor) return;
    try {
      if (blob === photoEditor.original) {
        updatePhotoAsset(photoEditor.assetId, (asset) => ({ ...asset, cutoutRef: null }));
      } else {
        const cutoutRef = await photoStore.saveBlob(blob, `${photoEditor.assetId}-manual-cutout.png`);
        updatePhotoAsset(photoEditor.assetId, (asset) => ({ ...asset, cutoutRef }));
      }
      setPhotoEditor(null);
      setPhotoError("");
    } catch {
      throw new Error("No se pudo guardar el recorte manual. La foto original sigue a salvo.");
    }
  }
  function commaList(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function resetGarmentDraft() {
    setGarmentName("");
    setCategory("top");
    setColor("");
    setSize("");
    setFit("regular");
    setSeasons("");
    setStyles("");
    setPhotoAssets([]);
    setPhotoError("");
    setPhotoProcessing({});
    setPhotoEditor(null);
    setSubtype("polera");
    setDescription("");
    setAvailability("available");
    setMeasurements({ length: "regular", width: "regular", sleeve: "long" });
    setEditingGarment(null);
  }
  const [addingStudioAccessory, setAddingStudioAccessory] = useState(false);

  function startNewGarment() {
    resetGarmentDraft();
    setSection("wardrobe");
    setShowGarmentForm(true);
  }
  function startEditingGarment(garment: Garment) {
    setAddingStudioAccessory(false);
    setEditingGarment(garment);
    setGarmentName(garment.name);
    setCategory(garment.category);
    setColor(garment.colors.join(", "));
    setSize(garment.size);
    setFit(garment.fit);
    setSeasons(garment.seasons.join(", "));
    setStyles(garment.styles.join(", "));
    setPhotoAssets(garment.photoAssets);
    setPhotoError("");
    setSubtype(garment.subtype);
    setDescription(garment.description);
    setAvailability(garment.availability);
    setMeasurements(garment.measurements);
    setGarmentEditRequest((request) => request + 1);
    setShowGarmentForm(true);
  }
  function cancelGarmentForm() {
    resetGarmentDraft();
    setShowGarmentForm(false);
  }
  function saveGarment() {
    if (!activeProfile) return;
    const input = {
      name: garmentName,
      category,
      colors: commaList(color),
      size,
      fit,
      seasons: commaList(seasons),
      styles: commaList(styles),
      notes: editingGarment?.notes ?? "",
      subtype,
      description,
      availability,
      measurements,
      imageUrls: photoAssets.map((asset) => asset.originalRef),
      photoAssets,
    };

    if (editingGarment) {
      const updated = wardrobeService.update(editingGarment, input);
      setGarments((items) =>
        items.map((garment) => garment.id === updated.id ? updated : garment),
      );
    } else {
      const garment = wardrobeService.save(activeProfile.id, input);
      setGarments((items) => [garment, ...items]);
      if (addingStudioAccessory) {
        setStudioLayout(layout => addCanvasGarment(layout, garment, new Date().toISOString()));
        setSection("studio");
        setAddingStudioAccessory(false);
      }
    }

    resetGarmentDraft();
    setShowGarmentForm(false);
  }
  function saveOutfit() {
    if (!activeProfile) return;
    if (!outfitName.trim() || !selectedIds.length) return;
    const outfit = outfitService.save(activeProfile.id, {
      name: outfitName,
      garmentIds: selectedIds,
    });
    setOutfits((items) => [outfit, ...items]);
    setOutfitName("");
    setSelectedIds([]);
  }
  function toggleGarment(id: string) {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }
  function selectStudioOutfit(outfit: Outfit) {
    if (!activeProfile) return;
    const selectedGarments = availableGarments.filter((garment) => outfit.garmentIds.includes(garment.id));
    setActiveOutfitId(outfit.id);
    setStudioLayout(outfit.canvas ? { ...outfit.canvas, items: outfit.canvas.items.filter((item) => selectedGarments.some((garment) => garment.id === item.garmentId)) } : createDefaultLayout(selectedGarments, new Date().toISOString()));
    setSection("studio");
  }
  function updateStudioLayout(layout: OutfitCanvasLayout) {
    setStudioLayout(layout);
  }
  function saveStudioOutfit(name: string, garmentIds: string[], layout: OutfitCanvasLayout) {
    if (!activeProfile) return;
    const current = profileOutfits.find((outfit) => outfit.id === activeOutfitId);
    if (current) {
      setOutfits((items) => items.map((outfit) => outfit.id === current.id
        ? { ...outfit, name, garmentIds, canvas: layout }
        : outfit));
      return;
    }
    const outfit = outfitService.save(activeProfile.id, { name, garmentIds, canvas: layout });
    setOutfits((items) => [outfit, ...items]);
    setActiveOutfitId(outfit.id);
  }
  function applyImportedState(incoming: SavedState) {
    const imported = singleWardrobe(incoming, activeProfile?.id);
    setAllProfiles(imported.profiles);
    setGarments(imported.garments);
    setOutfits(imported.outfits);
    setWearHistory(imported.wearHistory ?? []);
    setSelectedGarmentIdsByProfile(imported.selectedGarmentIdsByProfile);
    setActiveProfile((current) => current
      ? imported.profiles.find((profile) => profile.id === current.id) ?? imported.profiles[0] ?? null
      : imported.profiles[0] ?? null);
    setActiveOutfitId(null);
    setStudioLayout({ items: [], updatedAt: new Date().toISOString() });
  }

  const currentState: SavedState = {
    profiles: allProfiles,
    garments,
    outfits,
    selectedGarmentIdsByProfile,
    wearHistory,
  };

  function resetStudio() {
    setActiveOutfitId(null);
    setStudioLayout({ items: [], updatedAt: new Date().toISOString() });
    setSelectedIds([]);
  }

  function archiveGarment(garment: Garment) {
    if (garment.profileId !== activeProfile?.id) return;
    setGarments((items) => items.map((item) => item.id === garment.id ? { ...item, archivedAt: item.archivedAt ? null : new Date().toISOString() } : item));
    resetStudio();
  }

  function removeGarment(garment: Garment) {
    if (!activeProfile || garment.profileId !== activeProfile.id) return;
    const next = deleteGarment(currentState, activeProfile.id, garment.id);
    setGarments(next.garments);
    setOutfits(next.outfits);
    setSelectedGarmentIdsByProfile(next.selectedGarmentIdsByProfile);
    if (editingGarment?.id === garment.id) cancelGarmentForm();
    resetStudio();
    setActionMessage(`Se eliminó «${garment.name}». Su historial se conserva; puedes recuperarla si tienes una exportación anterior.`);
  }

  function archiveOutfit(outfit: Outfit) {
    if (outfit.profileId !== activeProfile?.id) return;
    setOutfits((items) => items.map((item) => item.id === outfit.id ? { ...item, archivedAt: item.archivedAt ? null : new Date().toISOString() } : item));
    if (activeOutfitId === outfit.id) resetStudio();
  }

  function removeOutfit(outfit: Outfit) {
    if (outfit.profileId !== activeProfile?.id) return;
    setOutfits((items) => items.filter((item) => item.id !== outfit.id));
    if (activeOutfitId === outfit.id) resetStudio();
    setActionMessage(`Se eliminó «${outfit.name}». Las prendas y el historial se conservan.`);
  }

  if (!activeProfile)
    return (
      <main className="welcome-shell">
        <section className="welcome-card" aria-labelledby="welcome-title">
          <div className="wardrobe-mark"><BrandIcon name="wardrobe" /></div>
          <p className="eyebrow">{ui("TU ESPACIO DE ESTILO")}</p>
          <h1 id="welcome-title">Ropero Virtual</h1>
          <p className="persistence-status" aria-live="polite">
            {persistenceStatus}
          </p>
          {persistenceWarning && <p className="persistence-warning" role="status">{persistenceWarning}</p>}
          <p className="welcome-copy">{ui("Organiza tus prendas y arma conjuntos con lo que ya tienes.")}</p>
          <label htmlFor="profile-name">{ui("Tu nombre")}</label>
          <input
            id="profile-name"
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            placeholder="Ej. Alex"
            disabled={!storageReady}
          />
          <button
            className="primary-button"
            type="button"
            onClick={createProfile}
            disabled={!storageReady}
          >{ui("Crear mi ropero")}</button>
          <p className="privacy-note">{ui("Tus perfiles tendrán roperos separados y guardados solo en este equipo.")}</p>
        </section>
      </main>
    );

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <span aria-hidden="true">🎀</span>
          <strong>Ropero</strong>
        </div>
        <p className="profile-label">{ui("PERFIL ACTIVO")}</p>
        <button className="profile-chip" type="button">
          {activeProfile.name.slice(0, 1).toUpperCase()}{" "}
          <span>{activeProfile.name}</span>
        </button>
        <nav aria-label={ui("Secciones del ropero")}>
          <button
            className={`nav-item ${section === "studio" ? "active" : ""}`}
            data-tour="studio"
            aria-current={section === "studio" ? "page" : undefined}
            onClick={() => setSection("studio")}
            type="button"
          >
            <span className="nav-symbol" aria-hidden="true"><BrandIcon name="studio" /></span><span lang={language}>{navigation.studio}</span>
          </button>
          <button
            className={`nav-item ${section === "wardrobe" ? "active" : ""}`}
            data-tour="wardrobe"
            aria-current={section === "wardrobe" ? "page" : undefined}
            onClick={() => setSection("wardrobe")}
            type="button"
          >
            <span className="nav-symbol" aria-hidden="true"><BrandIcon name="wardrobe" /></span><span lang={language}>{navigation.wardrobe}</span>
          </button>
          <button
            className={`nav-item ${section === "outfits" ? "active" : ""}`}
            data-tour="outfits"
            aria-current={section === "outfits" ? "page" : undefined}
            onClick={() => setSection("outfits")}
            type="button"
          >
            <span className="nav-symbol" aria-hidden="true"><BrandIcon name="outfits" /></span><span lang={language}>{navigation.outfits}</span>
          </button>
          <button
            className={`nav-item ${section === "settings" ? "active" : ""}`}
            aria-current={section === "settings" ? "page" : undefined}
            onClick={() => setSection("settings")}
            type="button"
          >
            <span className="nav-symbol" aria-hidden="true"><BrandIcon name="settings" /></span><span lang={language}>{navigation.settings}</span>
          </button>
        </nav>
      </aside>
      <section className="content">
        <header className="content-header">
          <div>
            <div className="wardrobe-tutorial-header">
              <span className="wardrobe-identity"><BrandIcon name="wardrobe" /> {activeProfile.name}</span>
              <WardrobeTutorial
                key={activeProfile.id}
                preferenceKey={`ropero-tutorial:v1:${activeProfile.id}`}
                canAutoOpen={storageReady && !showGarmentForm && !photoEditor}
                onAddGarment={() => {
                  if (showGarmentForm || photoEditor) {
                    setSection('wardrobe');
                    return;
                  }
                  startNewGarment();
                }}
                onOpenStudio={() => setSection('studio')}
                onTourSection={setSection}
              />
            </div>
            <p className="eyebrow">{ui("HOLA,")}{activeProfile.name.toUpperCase()}
            </p>
            <p className="persistence-status" aria-live="polite">
              {persistenceStatus}
            </p>
            {persistenceWarning && <p className="persistence-warning" role="status">{persistenceWarning}</p>}
            <h1>
              {section === "studio"
                ? ui("¿Qué quieres vestir hoy?")
                : section === "wardrobe"
                  ? ui("Tu ropero completo")
                : section === "outfits"
                  ? ui("Tus conjuntos favoritos")

                    : navigation.settings}
            </h1>
          </div>
          {(section === "studio" || section === "wardrobe") && (
            <div className="content-actions">
              <button
                className="primary-button compact"
                type="button"
                onClick={startNewGarment}
              >{ui("＋ Agregar prenda")}</button>
            </div>
          )}
        </header>
        {actionMessage && <p className="action-message" role="status">{actionMessage}</p>}
        {section === "studio" && (
          <OutfitCarousel
            key={activeProfile.id}
            onNew={resetStudio}
            accessoryTypes={[...garmentTypeOptions, ...customTypes].filter(type => type.category === "accessory")}
            onAddAccessory={(type) => {
              startNewGarment();
              setAddingStudioAccessory(true);
              setCategory("accessory");
              setSubtype(type ?? "accesorio");
            }}
            garments={availableGarments}
            outfits={availableOutfits}
            activeOutfitId={activeOutfitId}
            layout={studioLayout}
            resolvePhoto={photoStore.resolveUrl}
            onLayoutChange={updateStudioLayout}
            onSelectOutfit={selectStudioOutfit}
            onSave={saveStudioOutfit}
          />
        )}
        {section === "wardrobe" && (
          <WardrobeView
              garments={profileGarments}
              showForm={showGarmentForm}
              editRequest={garmentEditRequest}
              startNew={startNewGarment}
              name={garmentName}
              setName={setGarmentName}
               color={color}
               setColor={setColor}
              size={size}
              setSize={setSize}
              fit={fit}
              setFit={setFit}
              seasons={seasons}
              setSeasons={setSeasons}
              styles={styles}
              setStyles={setStyles}
              photoAssets={photoAssets}
              addPhotos={addPhotos}
              removePhoto={(assetId) => setPhotoAssets((items) => items.filter((item) => item.id !== assetId))}
              removePhotoBackground={removePhotoBackground}
              useOriginalPhoto={useOriginalPhoto}
              adjustPhoto={openPhotoEditor}
              photoProcessing={photoProcessing}
              photoError={photoError}
               subtype={subtype}
              customTypes={customTypes}
              accessoryDraft={addingStudioAccessory}
              addCustomType={(name, parent) => {
                const value = name.trim();
                const existing = [...garmentTypeGroups.flatMap(group => group.options), ...customTypes]
                  .find(item => item.value.toLocaleLowerCase() === value.toLocaleLowerCase()
                    || item.label.toLocaleLowerCase() === value.toLocaleLowerCase());
                if (existing) {
                  setSubtype(existing.value);
                  setCategory(existing.category);
                  return;
                }
                const next = [...customTypes, { value, label: value, category: parent }];
                localStorage.setItem("ropero-custom-types", JSON.stringify(next));
                setCustomTypes(next);
                setSubtype(value);
                setCategory(parent);
              }}
               setSubtype={(value) => {
                 setSubtype(value);
                 setCategory(customTypes.find(item => item.value === value)?.category ?? categoryForGarmentType(value, category));
               }}
               description={description}
               setDescription={setDescription}
              availability={availability}
              setAvailability={setAvailability}
              measurements={measurements}
              setMeasurements={setMeasurements}
              editing={Boolean(editingGarment)}
              cancel={cancelGarmentForm}
              edit={startEditingGarment}
              archive={archiveGarment}
              remove={removeGarment}
              filters={filters}
              setFilters={setFilters}
              resolvePhoto={photoStore.resolveUrl}
              save={saveGarment}
            />
        )}
        {section === "outfits" && (
          <OutfitsView
            garments={availableGarments}
            outfits={profileOutfits}
            resolvePhoto={photoStore.resolveUrl}
            name={outfitName}
            setName={setOutfitName}
            selectedIds={selectedIds}
            toggle={toggleGarment}
            save={saveOutfit}
            onTry={selectStudioOutfit}
            archive={archiveOutfit}
            remove={removeOutfit}
            key={activeProfile.id}
          />
        )}
        <BackgroundMusic visible={section === "settings"} />
        {section === "settings" && (
          <>
          <section className="wardrobe-transfer developer-contact" aria-labelledby="language-title">
            <h2 id="language-title" lang={language}>{navigation.language}</h2>
            <RoperoSelect label={navigation.language} value={language} options={languageOptions} onChange={setLanguage} />
          </section>
          <WardrobeTransfer
            state={currentState}
            storage={storageRef.current}
            onImported={applyImportedState}
          />
          <section className="wardrobe-transfer developer-contact" aria-labelledby="privacy-title">
            <h2 id="privacy-title">{ui("Privacidad y uso de datos")}</h2>
            <dl>
              <dt><strong>{ui("Guardado en tu dispositivo")}</strong></dt>
              <dd>{ui("Tus perfiles, prendas, fotos, conjuntos y preferencias se guardan en este dispositivo o navegador. Ropero Virtual no requiere una cuenta ni sincroniza tu ropero con un servidor.")}</dd>
              <dt><strong>{ui("Fotos, cámara y recorte")}</strong></dt>
              <dd>{ui("La cámara se usa cuando la abres para tomar una foto. El recorte automático puede necesitar internet para descargar el modelo. Tus fotos se procesan en el dispositivo y no se envían al proveedor del modelo.")}</dd>
              <dt><strong>{ui("Copias y control de tus datos")}</strong></dt>
              <dd>{ui("Puedes exportar una copia del ropero con sus fotos y conjuntos. Si la compartes, quien reciba el archivo podrá acceder a su contenido. Borrar los datos de la app o del sitio elimina la copia local. Exporta primero si quieres conservarla.")}</dd>
              <dt><strong>{ui("Enlaces externos")}</strong></dt>
              <dd>{ui("Los enlaces de contacto y créditos abren servicios externos. Esos servicios aplican sus propias políticas de privacidad.")}</dd>
            </dl>
          </section>
          <section className="wardrobe-transfer developer-contact" aria-labelledby="developer-contact-title">
            <h2 id="developer-contact-title">{ui("Contacto y sugerencias")}</h2>
            <p>{ui("¿Encontraste un problema o tienes una idea? Revisa el código y deja una sugerencia en GitHub.")}</p>
            <a href="https://github.com/NiorbDev/Ropero-Virtual" target="_blank" rel="noopener noreferrer">
              GitHub · EntreCapas
            </a>
          </section>
          </>
        )}
      </section>
      {photoEditor && (
        <PhotoCutoutEditor
          original={photoEditor.original}
          initialCutout={photoEditor.cutout}
          removeBackground={(photo) => {
            const service = backgroundRemovalRef.current ??= new BackgroundRemovalService();
            return service.remove(photo);
          }}
          onAccept={acceptManualCutout}
          onCancel={() => setPhotoEditor(null)}
        />
      )}
    </main>
  );
}

type WardrobeProps = {
  garments: Garment[];
  accessoryDraft: boolean;
  customTypes: Array<{ value: string; label: string; category: GarmentCategory }>;
  addCustomType: (name: string, parent: GarmentCategory) => void;
  showForm: boolean;
  editRequest: number;
  startNew: () => void;
  name: string;
  setName: (value: string) => void;
  color: string;
  setColor: (value: string) => void;
  size: string;
  setSize: (value: string) => void;
  fit: Fit;
  setFit: (value: Fit) => void;
  seasons: string;
  setSeasons: (value: string) => void;
  styles: string;
  setStyles: (value: string) => void;
  photoAssets: GarmentPhotoAsset[];
  addPhotos: (files: File[], openEditor?: boolean) => Promise<void>;
  removePhoto: (assetId: string) => void;
  removePhotoBackground: (assetId: string, openEditor?: boolean) => Promise<void>;
  useOriginalPhoto: (assetId: string) => void;
  adjustPhoto: (assetId: string) => Promise<void>;
  photoProcessing: Record<string, PhotoProcessStatus>;
  photoError: string;
  subtype: string;
  setSubtype: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  availability: GarmentAvailability;
  setAvailability: (value: GarmentAvailability) => void;
  measurements: GarmentMeasurements;
  setMeasurements: (value: GarmentMeasurements) => void;
  editing: boolean;
  cancel: () => void;
  edit: (garment: Garment) => void;
  archive: (garment: Garment) => void;
  remove: (garment: Garment) => void;
  filters: GarmentFilters;
  setFilters: (filters: GarmentFilters) => void;
  resolvePhoto: (reference: string) => Promise<string>;
  save: () => void;
};
function WardrobeView(props: WardrobeProps) {
  const formRef = useRef<HTMLElement>(null);
  const [customName, setCustomName] = useState("");
  const [customParent, setCustomParent] = useState<GarmentCategory>("top");
  const [customError, setCustomError] = useState("");
  useEffect(() => {
    if (!props.editRequest || !props.editing) return;
    const form = formRef.current;
    form?.focus({ preventScroll: true });
    form?.scrollIntoView?.({ block: "start" });
  }, [props.editRequest, props.editing]);
  const ui = useUiText();
  const [batchRunning, setBatchRunning] = useState(false);
  const pendingPhotos = props.photoAssets.filter((photo) => !photo.cutoutRef);
  const recorting = props.photoAssets.some(({ id }) => {
    const status = props.photoProcessing[id];
    return status && !status.error && status.progress < 1;
  });

  async function cutPendingPhotos() {
    setBatchRunning(true);
    try {
      for (const photo of pendingPhotos) await props.removePhotoBackground(photo.id);
    } finally {
      setBatchRunning(false);
    }
  }

  const [showArchived, setShowArchived] = useState(false);
  const collection = props.garments.filter((garment) => Boolean(garment.archivedAt) === showArchived);
  const visibleGarments = filterGarments(collection, props.filters);
  const filtersActive = hasActiveGarmentFilters(props.filters);
  const knownGarmentType = garmentTypeOptions.some((option) => option.value === props.subtype);
  return (
    <>
      <section className="tip-card">
        <span>💡</span>
        <p>
          <strong>Tip:</strong> la foto y todos los detalles quedan guardados
          localmente en este equipo.
        </p>
      </section>
      {!props.showForm && (<section className="wardrobe-filters" aria-label="Filtros del ropero">
        <label>{ui("Buscar prendas")}<input
            aria-label={ui("Buscar prendas")}
            type="search"
            value={props.filters.query}
            onChange={(event) => props.setFilters({ ...props.filters, query: event.target.value })}
            placeholder={ui("Nombre, color o descripción")}
          />
        </label>
        <div className="ropero-select-field"><span>{ui("Categoría")}</span><RoperoSelect label={ui("Filtrar categoría")} value={props.filters.category} onChange={(value) => props.setFilters({ ...props.filters, category: value as GarmentFilters["category"] })}
                options={[{ value: "all", label: ui("Todas") }, ...categories]} /></div>
        <div className="ropero-select-field"><span>{ui("Filtrar disponibilidad")}</span><RoperoSelect label={ui("Filtrar disponibilidad")} value={props.filters.availability} onChange={(value) => props.setFilters({ ...props.filters, availability: value as GarmentFilters["availability"] })}
                options={[{ value: "all", label: ui("Todas") }, { value: "available", label: ui("Disponible") }, { value: "borrowed", label: ui("Prestada") }, { value: "avoid", label: ui("No recomendar") }]} /></div>
        <button
          className="filter-reset-button"
          type="button"
          disabled={!filtersActive}
          onClick={() => props.setFilters(emptyGarmentFilters)}
        ><BrandIcon name="reset" />{ui("Limpiar filtros")}</button>
      </section>)}
      {props.showForm && (
        <section
          ref={formRef}
          tabIndex={-1}
          style={{ scrollMarginTop: "1rem" }}
          className="garment-form detailed-form"
          aria-label={ui(props.editing ? "Editar prenda" : "Nueva prenda")}
        >
          <GarmentPhotoPicker onPhotos={props.addPhotos} />
          {props.photoAssets.length > 1 && pendingPhotos.length > 0 && (
            <button className="text-button wide-field" type="button" disabled={batchRunning || recorting} onClick={() => void cutPendingPhotos()}>
              {batchRunning ? ui("Recortando fotos…") : ui("Quitar fondo a todas las fotos pendientes")}
            </button>
          )}
          {props.photoAssets.length > 0 && (
            <div className="photo-list wide-field">
              {props.photoAssets.map((asset, index) => {
                const processing = props.photoProcessing[asset.id];
                const busy = Boolean(processing && !processing.error && processing.progress < 1);
                return (
                <div className="photo-item" key={asset.id}>
                  <StoredPhoto
                    className="photo-preview"
                    reference={asset.cutoutRef ?? asset.originalRef}
                    resolvePhoto={props.resolvePhoto}
                    alt={`Vista previa ${index + 1} de la prenda`}
                  />
                  <div className="photo-item-actions">
                    <button className="text-button" type="button" disabled={busy || batchRunning} onClick={() => void props.removePhotoBackground(asset.id, true)}>
                      {asset.cutoutRef ? ui("Rehacer recorte automático") : ui("Quitar fondo automáticamente")}
                    </button>
                    <button className="text-button" type="button" disabled={busy || batchRunning} onClick={() => void props.adjustPhoto(asset.id)}>{ui("Ajustar recorte")}</button>
                    {asset.cutoutRef && <button className="text-button" type="button" disabled={busy || batchRunning} onClick={() => props.useOriginalPhoto(asset.id)}>{ui("Usar foto con fondo")}</button>}
                  </div>
                  {busy && <p className="photo-process-status" role="status">{ui("Recortando…")}{Math.round((processing?.progress ?? 0) * 100)}%</p>}
                  {processing?.error && <p className="form-error" role="alert">{processing.error}</p>}
                  <button className="text-button photo-remove" type="button" disabled={busy || batchRunning} onClick={() => props.removePhoto(asset.id)}>{ui("Quitar foto")}{index + 1}
                  </button>
                </div>
              );})}
            </div>
          )}
          {props.photoError && <p className="form-error wide-field" role="alert">{props.photoError}</p>}
          <p className="quick-form-hint wide-field">{ui("Con el nombre basta para guardarla. Puedes usar la foto con su fondo; quitarlo es opcional.")}</p>
          <label>{ui("Nombre")}<input
              aria-label={ui("Nombre de la prenda")}
              value={props.name}
              onChange={(event) => props.setName(event.target.value)}
              placeholder={ui("Ej. Chaqueta beige")}
              required
            />
          </label>
          <div className="ropero-select-field"><span>{ui("Tipo")}</span><RoperoSelect label={ui("Tipo de prenda")} value={props.subtype} onChange={(value) => props.setSubtype(value)}
                options={[...(!knownGarmentType && !props.customTypes.some(item => item.value === props.subtype) && props.subtype ? [{ value: props.subtype, label: props.subtype + " (registrado)" }] : []), ...garmentTypeGroups.flatMap((group) => group.options.filter(option => !props.accessoryDraft || option.category === "accessory").map((option) => ({ ...option, group: group.label }))), ...props.customTypes.filter(item => !props.accessoryDraft || item.category === "accessory").map(item => ({ ...item, group: ui("Personalizadas") }))]} /></div>
          <details className="wide-field">
            <summary>{ui("Agregar categoría")}</summary>
            <label>{ui("Nombre de la categoría")}<input value={customName} maxLength={60} onChange={event => setCustomName(event.target.value)} /></label>
            {!props.accessoryDraft && <RoperoSelect label={ui("Ubicación en el probador")} value={customParent}
              onChange={value => setCustomParent(value as GarmentCategory)}
              options={garmentTypeGroups.flatMap(group => {
                const option = group.options[0];
                return option ? [{ value: option.category, label: ui(group.label) }] : [];
              })} />}
            <button type="button" disabled={!customName.trim()} onClick={() => {
              try {
                props.addCustomType(customName, props.accessoryDraft ? "accessory" : customParent);
                setCustomName("");
                setCustomError("");
              } catch {
                setCustomError(ui("No se pudo guardar la categoría"));
              }
            }}>{ui("Guardar categoría")}</button>
            {customError && <p role="alert">{customError}</p>}
          </details>
          <label>{ui("Color")}<input
              aria-label={ui("Color")}
              value={props.color}
              onChange={(event) => props.setColor(event.target.value)}
              placeholder={ui("Negro, lila")}
            />
          </label>
          <div className="ropero-select-field"><span>{ui("Cómo te queda")}</span><RoperoSelect label={ui("Cómo te queda")} value={props.fit} onChange={(value) => props.setFit(value as Fit)}
                options={[{ value: "fitted", label: ui("Entallada") }, { value: "regular", label: ui("Regular") }, { value: "oversized", label: ui("Holgada / oversized") }]} /></div>
          <label className="wide-field">{ui("Descripción")}<textarea
              aria-label={ui("Descripción")}
              value={props.description}
              onChange={(event) => props.setDescription(event.target.value)}
              placeholder="Cuello, bolsillos, franjas, estampados o cualquier detalle importante…"
            />
          </label>
          <details className="garment-more-details wide-field">
            <summary>{ui("Más detalles")}</summary>
            <div className="garment-more-grid">
              <label>{ui("Talla")}<input aria-label={ui("Talla")} value={props.size} onChange={(event) => props.setSize(event.target.value)} /></label>
              <div className="ropero-select-field"><span>{ui("Disponibilidad")}</span><RoperoSelect label={ui("Disponibilidad")} value={props.availability} onChange={(value) => props.setAvailability(value as GarmentAvailability)}
                options={[{ value: "available", label: ui("Disponible") }, { value: "borrowed", label: ui("Prestada / de otra persona") }, { value: "avoid", label: ui("No recomendar") }]} /></div>
              <div className="ropero-select-field"><span>{ui("Largo aproximado")}</span><RoperoSelect label={ui("Largo aproximado")} value={props.measurements.length} onChange={(value) => props.setMeasurements({ ...props.measurements, length: value as GarmentMeasurements['length'] })}
                options={[{ value: "short", label: ui("Corto") }, { value: "regular", label: ui("Regular") }, { value: "long", label: ui("Largo") }]} /></div>
              <div className="ropero-select-field"><span>{ui("Ancho aproximado")}</span><RoperoSelect label={ui("Ancho aproximado")} value={props.measurements.width} onChange={(value) => props.setMeasurements({ ...props.measurements, width: value as GarmentMeasurements['width'] })}
                options={[{ value: "fitted", label: ui("Estrecho") }, { value: "regular", label: ui("Regular") }, { value: "wide", label: ui("Ancho") }]} /></div>
              <div className="ropero-select-field"><span>{ui("Mangas aproximadas")}</span><RoperoSelect label={ui("Mangas aproximadas")} value={props.measurements.sleeve} onChange={(value) => props.setMeasurements({ ...props.measurements, sleeve: value as GarmentMeasurements['sleeve'] })}
                options={[{ value: "sleeveless", label: ui("Sin mangas") }, { value: "short", label: "Corta" }, { value: "three-quarter", label: "¾" }, { value: "long", label: "Larga" }]} /></div>
              <label>{ui("Largo (cm opcional)")}<input aria-label={ui("Largo en cm")} type="number" min="1" value={props.measurements.lengthCm ?? ''} onChange={(event) => props.setMeasurements({ ...props.measurements, lengthCm: event.target.value ? Number(event.target.value) : undefined })} /></label>
              <label>{ui("Ancho (cm opcional)")}<input aria-label={ui("Ancho en cm")} type="number" min="1" value={props.measurements.widthCm ?? ''} onChange={(event) => props.setMeasurements({ ...props.measurements, widthCm: event.target.value ? Number(event.target.value) : undefined })} /></label>
              <label>{ui("Manga (cm opcional)")}<input aria-label={ui("Manga en cm")} type="number" min="1" value={props.measurements.sleeveCm ?? ''} onChange={(event) => props.setMeasurements({ ...props.measurements, sleeveCm: event.target.value ? Number(event.target.value) : undefined })} /></label>
              <label>{ui("Temporadas")}<input aria-label={ui("Temporadas")} value={props.seasons} onChange={(event) => props.setSeasons(event.target.value)} placeholder={ui("Invierno, otoño")} /></label>
              <label>{ui("Estilos")}<input aria-label={ui("Estilos")} value={props.styles} onChange={(event) => props.setStyles(event.target.value)} placeholder="Kawaii, casual" /></label>
            </div>
          </details>
          <div className="garment-form-actions wide-field">
            <button className="primary-button compact" type="button" onClick={props.save} disabled={!props.name.trim() || recorting || batchRunning}>
              {props.editing ? ui("Guardar cambios") : ui("Guardar prenda")}
            </button>
            <button className="text-button" type="button" onClick={props.cancel}>{ui("Cancelar")}</button>
          </div>
        </section>
      )}

      <section className="collection-header">
        <div>
          <h2>{showArchived ? ui("Prendas archivadas") : ui("Mi colección")}</h2>
          <p>
            {filtersActive
              ? `${visibleGarments.length} de ${collection.length} prendas`
              : `${collection.length} prenda${collection.length === 1 ? "" : "s"} guardada${collection.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <label className="archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />{ui("Ver prendas archivadas")}</label>
      </section>
      {collection.length === 0 ? (
        <section className="empty-state">
          <img className="wardrobe-empty-art" src="/theme/sakura-dress.svg" alt="" width="112" height="112" />
          <h2>{showArchived ? ui("No tienes prendas archivadas") : ui("Tu ropero está esperando")}</h2>
          <button
            className="primary-button"
            type="button"
            onClick={props.startNew}
          >{ui("Agregar mi primera prenda")}</button>
        </section>
      ) : visibleGarments.length === 0 ? (
        <section className="empty-state">
          <div>⌕</div>
          <h2>{ui("No encontramos prendas con esos filtros")}</h2>
          <button className="filter-reset-button" type="button" onClick={() => props.setFilters(emptyGarmentFilters)}><BrandIcon name="reset" />{ui("Limpiar filtros")}</button>
        </section>
      ) : (
        <section className="garment-grid">
          {visibleGarments.map((garment) => (
            <GarmentCard
              key={garment.id}
              garment={garment}
              edit={props.edit}
              archive={props.archive}
              remove={props.remove}
              resolvePhoto={props.resolvePhoto}
            />
          ))}
        </section>
      )}
    </>
  );
}
function GarmentCard({
  garment,
  edit,
  resolvePhoto,
  archive,
  remove,
}: {
  garment: Garment;
  edit: (garment: Garment) => void;
  resolvePhoto: (reference: string) => Promise<string>;
  archive: (garment: Garment) => void;
  remove: (garment: Garment) => void;
}) {
  const ui = useUiText();
  const type = categoryFor(garment.category);
  const photo = garment.photoAssets[0];
  const photoReference = photo?.cutoutRef ?? photo?.originalRef ?? garment.imageUrls[0];
  return (
    <article className="garment-card wardrobe-garment-card">
      {photoReference ? (
        <StoredPhoto
          className="garment-photo"
          reference={photoReference}
          resolvePhoto={resolvePhoto}
          alt={garment.name}
        />
      ) : (
        <div className="garment-emoji"><BrandIcon name={garment.category} /></div>
      )}
      <p className="category-pill">{type.label}</p>
      <h3>{garment.name}</h3>
      <p>
        {garment.colors.join(", ") || ui("Sin color indicado")} ·{" "}
        {garment.size || "sin talla"}
      </p>
      <p className="details-line">
        {garment.fit === "oversized"
          ? ui("Holgada")
          : garment.fit === "fitted"
            ? ui("Entallada")
            : ui("Regular")}
      </p>
      <div className="wardrobe-card-actions">
        <button className="edit-garment-button" type="button" onClick={() => edit(garment)}>
          <span>{ui("Editar")}{' '}{garment.name}</span>
        </button>
        <ItemActions name={garment.name} archived={Boolean(garment.archivedAt)} onArchive={() => archive(garment)} onDelete={() => remove(garment)} />
      </div>
    </article>
  );
}

function StoredPhoto({
  reference,
  resolvePhoto,
  className,
  alt,
}: {
  reference: string;
  resolvePhoto: (reference: string) => Promise<string>;
  className: string;
  alt: string;
}) {
  const [source, setSource] = useState(
    reference.startsWith("app-photo://") ? "" : reference,
  );

  useEffect(() => {
    let current = true;
    if (reference.startsWith("app-photo://")) setSource("");

    void resolvePhoto(reference).then(
      (resolved) => {
        if (current) setSource(resolved);
      },
      () => {
        if (current) setSource("");
      },
    );

    return () => {
      current = false;
    };
  }, [reference, resolvePhoto]);

  if (!source) {
    return <div className={`${className} photo-loading`} aria-label={alt}><BrandIcon name="photo" /></div>;
  }
  return <img className={className} src={source} alt={alt} decoding="async" loading={className === "garment-photo" || className === "saved-outfit-photo" || className === "outfit-picker-photo" ? "lazy" : undefined} />;
}

function OutfitsView({
  garments,
  outfits,
  resolvePhoto,
  name,
  setName,
  selectedIds,
  toggle,
  save,
  onTry,
  archive,
  remove,
}: {
  garments: Garment[];
  outfits: Outfit[];
  resolvePhoto: (reference: string) => Promise<string>;
  name: string;
  setName: (name: string) => void;
  selectedIds: string[];
  toggle: (id: string) => void;
  save: () => void;
  onTry: (outfit: Outfit) => void;
  archive: (outfit: Outfit) => void;
  remove: (outfit: Outfit) => void;
}) {
  const ui = useUiText();
  const [showArchived, setShowArchived] = useState(false);
  const garmentById = useMemo(() => new Map(garments.map((garment) => [garment.id, garment])), [garments]);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<GarmentCategory | "all">("all");
  const visibleGarments = useMemo(() => {
    const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const term = normalize(query.trim());
    return garments.filter((garment) =>
      (categoryFilter === "all" || garment.category === categoryFilter) &&
      normalize([garment.name, garment.subtype, ...garment.colors].join(" ")).includes(term)
    );
  }, [garments, query, categoryFilter]);
  return (
    <>
      <section className="outfit-builder">
        <h2>{ui("Crear un conjunto")}</h2>
        <label>{ui("Nombre del conjunto")}<input
            aria-label={ui("Nombre del conjunto")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={ui("Salida del sábado")}
          />
        </label>
        <div className="outfit-picker-heading">
          <strong>{ui("Prendas")}<small>· {selectedIds.length}{ui("seleccionadas")}</small></strong>
          <button className="outfit-search-toggle" type="button" aria-label={ui("Buscar y filtrar prendas")}
            aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {showFilters && <div className="outfit-picker-filters">
          <input type="search" aria-label={ui("Buscar prendas para el conjunto")} placeholder={ui("Nombre, tipo o color")} value={query} onChange={(event) => setQuery(event.target.value)} />
          <RoperoSelect label={ui("Categoría de prenda")} value={categoryFilter} onChange={setCategoryFilter}
            options={[{ value: "all", label: ui("Todas las categorías") }, ...categories]} />
          {(query || categoryFilter !== "all") && <button type="button" className="filter-reset-button" onClick={() => { setQuery(""); setCategoryFilter("all"); }}><BrandIcon name="reset" />{ui("Limpiar filtros")}</button>}
        </div>}
        {!visibleGarments.length && <p>{garments.length ? ui("No hay prendas que coincidan.") : ui("Agrega prendas en Mi ropero para combinarlas.")}</p>}
        <div className="selection-grid outfit-photo-picker">
          {visibleGarments.map((garment) => {
            const photo = garment.photoAssets[0];
            const reference = photo?.cutoutRef ?? photo?.originalRef ?? garment.imageUrls[0];
            const selected = selectedIds.includes(garment.id);
            return <button type="button" key={garment.id} className="outfit-photo-option"
              aria-label={garment.name} aria-pressed={selected} onClick={() => toggle(garment.id)}>
              {reference ? <StoredPhoto className="outfit-picker-photo" reference={reference} resolvePhoto={resolvePhoto} alt="" /> : <BrandIcon name={garment.category} />}
              {selected && <svg className="outfit-photo-check" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
            </button>;
          })}
        </div>
        <button className="primary-button" type="button" onClick={save} disabled={!name.trim() || !selectedIds.length}>{ui("Guardar conjunto")}</button>
      </section>
      <label className="archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />{ui("Ver conjuntos archivados")}</label>
      <section className="garment-grid">
        {outfits.filter((outfit) => Boolean(outfit.archivedAt) === showArchived).map((outfit) => (
          <article className="garment-card" key={outfit.id}>
            <p className="category-pill">{ui("CONJUNTO")}</p>
            <h3>{outfit.name}</h3>
            <div className="saved-outfit-preview" aria-label={ui("Vista previa del conjunto")}>
              {outfit.garmentIds.map((id) => {
                const garment = garmentById.get(id);
                if (!garment) return <span key={id} className="saved-outfit-piece"><BrandIcon name="wardrobe" /><small>{ui("Prenda no disponible")}</small></span>;
                const item = outfit.canvas?.items.find((entry) => entry.garmentId === id);
                const photo = garment.photoAssets.find((asset) => asset.id === item?.photoAssetId) ?? garment.photoAssets[0];
                const reference = photo?.cutoutRef ?? photo?.originalRef ?? garment.imageUrls[0];
                return <span key={id} className="saved-outfit-piece">
                  {reference ? <StoredPhoto className="saved-outfit-photo" reference={reference} resolvePhoto={resolvePhoto} alt={garment.name} /> : <BrandIcon name={garment.category} />}
                  <small>{garment.name}</small>
                </span>;
              })}
            </div>
            <button
              type="button"
              className="fitting-button"
              onClick={() => onTry(outfit)}
              disabled={Boolean(outfit.archivedAt) || !outfit.garmentIds.some((id) => garments.some((garment) => garment.id === id))}
            >{ui("Probar conjunto")}{outfit.name}
            </button>
            <ItemActions name={outfit.name} archived={Boolean(outfit.archivedAt)} onArchive={() => archive(outfit)} onDelete={() => remove(outfit)} />
          </article>
        ))}
      </section>
    </>
  );
}
export default App;
