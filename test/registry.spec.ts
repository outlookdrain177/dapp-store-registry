import { DAppStoreSchema } from "../src/interfaces";
import { DappStoreRegistry, RegistryStrategy } from "../src/lib/registry";
import chai from "chai";
import fs from "fs-extra";
import Sinon from "sinon";
import nock from "nock";
import parseISO from "date-fns/parseISO";

chai.should();

const getRegistry = async (fixtureRegistryJson: DAppStoreSchema) => {
  nock("https://raw.githubusercontent.com")
    .get("/merokudao/dapp-store-registry/main/src/registry.json")
    .twice()
    .reply(200, fixtureRegistryJson);

  const registry = new DappStoreRegistry();
  await registry.init();
  return registry;
};

describe("DappStoreRegistry", () => {
  describe("Registry Strategy", () => {
    let localRegistryJson: DAppStoreSchema;
    let fixtureRegistryJson: DAppStoreSchema;

    before(() => {
      const content = fs
        .readFileSync("./test/fixtures/registry.json")
        .toString();

      fixtureRegistryJson = JSON.parse(content) as DAppStoreSchema;
      localRegistryJson = JSON.parse(
        fs.readFileSync("./src/registry.json").toString()
      );
    });

    /**
     * Since the local registry file can differ from remote, in which case
     * the init() call will use the local registry, hence it's important to
     * use the remote as the source of truth.
     */
    it("uses the local registry file upon Static RegistryStrategy", async () => {
      const response = await fetch(new DappStoreRegistry().registryRemoteUrl);
      const localRegistryJson1 = await response.json();

      const registry = new DappStoreRegistry(RegistryStrategy.Static);
      await registry.init();

      const dApps = await registry.dApps({});

      dApps.should.be.an("array");
      dApps.should.deep.equal(localRegistryJson1.dapps);

      const featuredDapps = await registry.getFeaturedDapps();
      if (featuredDapps) {
        featuredDapps.should.equal(localRegistryJson1.featuredSections);
      }

      (await registry.getRegistryTitle()).should.equal(
        localRegistryJson1.title
      );

      const listedDapps = localRegistryJson1.dapps.filter(
        dapp => dapp.isListed
      );
      (await registry.dApps()).should.deep.equal(listedDapps);
    });

    it("uses the remote registry file upon GitHub RegistryStrategy", async () => {
      nock("https://raw.githubusercontent.com")
        .get("/merokudao/dapp-store-registry/main/src/registry.json")
        .reply(200, localRegistryJson);

      const registry = new DappStoreRegistry(RegistryStrategy.GitHub);
      await registry.init();

      (await registry.getRegistryTitle()).should.equal(localRegistryJson.title);

      (await registry.dApps()).should.be.an("array");
      (await registry.dApps({})).should.deep.equal(localRegistryJson.dapps);

      const featuredDapps = await registry.getFeaturedDapps();
      if (featuredDapps) {
        featuredDapps.should.equal(localRegistryJson.featuredSections);
      }

      nock.cleanAll();
    });

    it("uses local registry if remote can't be loaded", async () => {
      nock("https://raw.githubusercontent.com")
        .get("/merokudao/dapp-store-registry/main/src/registry.json")
        .reply(404);
      const registry = new DappStoreRegistry(RegistryStrategy.GitHub);
      await registry.init();

      (await registry.dApps()).should.be.an("array");

      const featuredDapps = await registry.getFeaturedDapps();
      if (featuredDapps) {
        featuredDapps.should.equal(localRegistryJson.featuredSections);
      }

      (await registry.getRegistryTitle()).should.equal(localRegistryJson.title);

      nock.cleanAll();
    });
  });

  describe("#dApps", () => {
    let registry: DappStoreRegistry;
    let fixtureRegistryJson: DAppStoreSchema;

    before(async () => {
      const content = fs
        .readFileSync("./test/fixtures/registry.json")
        .toString();

      fixtureRegistryJson = JSON.parse(content) as DAppStoreSchema;
      registry = await getRegistry(fixtureRegistryJson);
    });

    it("is able to filter results on chainId", async () => {
      const registry_dapps_1 = await registry.dApps({ chainId: 1 });
      const dapps_1 = fixtureRegistryJson.dapps.filter(dapp =>
        dapp.chains.includes(1)
      );
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to filter results on language", async () => {
      const language = "hi";
      const registry_dapps_1 = await registry.dApps({ language: language });
      const dapps_1 = fixtureRegistryJson.dapps.filter(
        dapp => dapp.language === language
      );
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to filter results on age", async () => {
      const age = 19;
      const registry_dapps_1 = await registry.dApps({ minAge: age });
      const dapps_1 = fixtureRegistryJson.dapps.filter(
        dapp => dapp.minAge > age
      );
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to filter results on listing (isListed: true)", async () => {
      const registry_dapps_1 = await registry.dApps({ isListed: true });
      const dapps_1 = fixtureRegistryJson.dapps.filter(dapp => dapp.isListed);
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to filter results on listing (isListed: false)", async () => {
      const registry_dapps_1 = await registry.dApps({ isListed: false });
      const dapps_1 = fixtureRegistryJson.dapps.filter(dapp => !dapp.isListed);
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to filter results on matureAudience flag", async () => {
      const registry_dapps_1 = await registry.dApps({
        forMatureAudience: true
      });
      const dapps_1 = fixtureRegistryJson.dapps.filter(
        dapp => dapp.isForMatureAudience
      );
      registry_dapps_1.should.deep.equal(dapps_1);

      const registry_dapps_2 = await registry.dApps({
        forMatureAudience: false
      });
      const dapps_2 = fixtureRegistryJson.dapps.filter(
        dapp => !dapp.isForMatureAudience
      );
      registry_dapps_2.should.deep.equal(dapps_2);
    });

    it("is able to filter results on specific developer", async () => {
      const registry_dapps_1 = await registry.dApps({
        developer: {
          githubID: "bitpack1"
        }
      });
      const dapps_1 = fixtureRegistryJson.dapps.filter(
        dapp => dapp.developer?.githubID === "bitpack1"
      );
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to filter results on category", async () => {
      const categories = ["music"];
      const registry_dapps_1 = await registry.dApps({ categories: categories });
      const dapps_1 = fixtureRegistryJson.dapps.filter(dapp =>
        categories.includes(dapp.category)
      );
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to filter results on platform", async () => {
      let platforms = ["ios"];
      const registry_dapps_1 = await registry.dApps({
        availableOnPlatform: platforms
      });
      const dapps_1 = fixtureRegistryJson.dapps.filter(dapp =>
        dapp.availableOnPlatform.some(x => platforms.includes(x))
      );
      registry_dapps_1.should.deep.equal(dapps_1);

      platforms = ["ios", "android"];
      const registry_dapps_2 = await registry.dApps({
        availableOnPlatform: platforms
      });
      const dapps_2 = fixtureRegistryJson.dapps.filter(dapp =>
        dapp.availableOnPlatform.some(x => platforms.includes(x))
      );
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to filter results on allowed countries", async () => {
      let validCountries = ["IN"];
      const registry_dapps_1 = await registry.dApps({
        allowedInCountries: validCountries
      });
      const dapps_1 = fixtureRegistryJson.dapps.filter(dapp => {
        return dapp.geoRestrictions?.allowedCountries?.some(x =>
          validCountries.includes(x)
        );
      });
      registry_dapps_1.should.deep.equal(dapps_1);

      validCountries = ["AU", "US"];
      const registry_dapps_2 = await registry.dApps({
        allowedInCountries: ["AU", "US"]
      });
      const dapps_2 = fixtureRegistryJson.dapps.filter(dapp => {
        return dapp.geoRestrictions?.allowedCountries?.some(x =>
          validCountries.includes(x)
        );
      });
      registry_dapps_2.should.deep.equal(dapps_2);
    });

    it("is able to filter results on blocked countries", async () => {
      let invalidCountries = ["CN"];
      const registry_dapps_1 = await registry.dApps({
        blockedInCountries: invalidCountries
      });
      const dapps_1 = fixtureRegistryJson.dapps.filter(dapp => {
        return dapp.geoRestrictions?.blockedCountries?.some(x =>
          invalidCountries.includes(x)
        );
      });
      registry_dapps_1.should.deep.equal(dapps_1);

      invalidCountries = ["RU"];
      const registry_dapps_2 = await registry.dApps({
        blockedInCountries: invalidCountries
      });
      const dapps_2 = fixtureRegistryJson.dapps.filter(dapp => {
        return dapp.geoRestrictions?.blockedCountries?.some(x =>
          invalidCountries.includes(x)
        );
      });
      registry_dapps_2.should.deep.equal(dapps_2);
    });

    it("is able to filter results on or after certain list date", async () => {
      let startDate = new Date(2022, 1, 1);
      const registry_dapps_1 = await registry.dApps({
        listedOnOrAfter: startDate
      });
      const dapps_1 = fixtureRegistryJson.dapps.filter(dapp => {
        return parseISO(dapp.listDate) > startDate;
      });
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to filter results on or before certain list date", async () => {
      let endDate = new Date(2022, 1, 1);
      const registry_dapps_1 = await registry.dApps({
        listedOnOrBefore: endDate
      });
      const dapps_1 = fixtureRegistryJson.dapps.filter(dapp => {
        return parseISO(dapp.listDate) < endDate;
      });
      registry_dapps_1.should.deep.equal(dapps_1);
    });

    it("is able to perform multiple filters", async () => {
      const language = "hi";
      const age = 19;
      const registry_dapps_1 = await registry.dApps({
        language: language,
        minAge: age
      });
      const dapps_1 = fixtureRegistryJson.dapps.filter(
        dapp => dapp.language === language && dapp.minAge > age
      );
      registry_dapps_1.should.deep.equal(dapps_1);
    });
  });
});