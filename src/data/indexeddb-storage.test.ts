// @vitest-environment node
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { blankState } from "./app-state-store";
import { createIndexedDbStorage } from "./indexeddb-storage";

it("recovers the wardrobe and photo bytes when storage is reopened", async () => {
  const name = "ropero-reopen-" + crypto.randomUUID();
  const first = await createIndexedDbStorage(name);
  const profile = {
    id: "local-profile",
    name: "Ropero de prueba",
    accentColor: "#814354",
    createdAt: "2026-11-15T12:00:00Z",
  };
  const photo = new Blob(["photo"], { type: "image/png" });
  const reference = await first.photoStore.saveBlob(photo, "sample.png");
  await first.stateStore.save({ ...blankState, profiles: [profile] });

  const reopened = await createIndexedDbStorage(name);
  const saved = await reopened.stateStore.load(blankState);
  expect(saved.source).toBe("primary");
  expect(saved.state.profiles).toEqual([profile]);
  const recoveredPhoto = await reopened.photoStore.readBlob(reference);
  expect(recoveredPhoto.type).toBe("image/png");
  expect(await recoveredPhoto.text()).toBe("photo");
});
