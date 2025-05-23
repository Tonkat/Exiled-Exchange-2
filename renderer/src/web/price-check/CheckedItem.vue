<template>
  <div v-if="show" class="p-4 layout-column min-h-0">
    <filter-name :filters="itemFilters" :item="item" />
    <!-- <price-prediction v-if="showPredictedPrice" class="mb-4" :item="item" /> -->
    <!-- <price-trend v-else :item="item" :filters="itemFilters" /> -->
    <!-- <price-trend :item="item" :filters="itemFilters" /> -->
    <filters-block
      ref="filtersComponent"
      :filters="itemFilters"
      :stats="itemStats"
      :item="item"
      :presets="presets"
      :weightFilters="weightFilters"
      @preset="selectPreset"
      @submit="doSearch = true"
      :rebuild-key="rebuildKey"
    />
    <trade-listing
      v-if="tradeAPI === 'trade' && doSearch"
      ref="tradeService"
      :filters="itemFilters"
      :stats="itemStats"
      :item="item"
      :weightFilters="weightFilters"
    />
    <trade-bulk
      v-if="tradeAPI === 'bulk' && doSearch"
      ref="tradeService"
      :filters="itemFilters"
      :item="item"
    />
    <div v-if="!doSearch" class="flex justify-between items-center">
      <div class="flex w-40" @mouseenter="handleSearchMouseenter">
        <button class="btn" @click="doSearch = true" style="min-width: 5rem">
          {{ t("Search") }}
        </button>
      </div>
      <div class="flex flex-row gap-1">
        <trade-links
          v-if="tradeAPI === 'trade' && showPseudoLink"
          :get-link="makeTradeLinkPseudo"
          text="filters.tag_pseudo"
        />
        <trade-links v-if="tradeAPI === 'trade'" :get-link="makeTradeLink" />
      </div>
    </div>
    <calculated-result class="mt-4" :raw-text="item.rawText" />
    <stack-value :filters="itemFilters" :item="item" />
    <div v-if="showSupportLinks" class="mt-auto border border-dashed p-2">
      <div class="mb-1">
        {{ t("Support development on") }}
        <a
          href="https://patreon.com/awakened_poe_trade"
          class="inline-flex align-middle animate__animated animate__fadeInRight"
          target="_blank"
          ><img class="inline h-5" src="/images/Patreon.svg"
        /></a>
      </div>
      <i18n-t keypath="app.thanks_3rd_party" tag="div">
        <a
          href="https://poeprices.info"
          target="_blank"
          class="bg-gray-900 px-1 rounded"
          >poeprices.info</a
        >
        <a
          href="https://poe.ninja/support"
          target="_blank"
          class="bg-gray-900 px-1 rounded"
          >poe.ninja</a
        >
      </i18n-t>
    </div>
    <tip v-else-if="showTip" :selected="showTip" />
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  PropType,
  watch,
  ref,
  nextTick,
  computed,
  ComponentPublicInstance,
} from "vue";
import { useI18n } from "vue-i18n";
import { ItemRarity, ItemCategory, ParsedItem } from "@/parser";
import TradeListing from "./trade/TradeListing.vue";
import TradeBulk from "./trade/TradeBulk.vue";
import TradeLinks from "./trade/TradeLinks.vue";
import CalculatedResult from "./CalculatedResult.vue";
import { apiToSatisfySearch, getTradeEndpoint } from "./trade/common";
import PriceTrend from "./trends/PriceTrend.vue";
import FiltersBlock from "./filters/FiltersBlock.vue";
import { createPresets } from "./filters/create-presets";
import PricePrediction from "./price-prediction/PricePrediction.vue";
import StackValue from "./stack-value/StackValue.vue";
import FilterName from "./filters/FilterName.vue";
import Tip from "../help/Tip.vue";
import {
  CATEGORY_TO_TRADE_ID,
  createTradeRequest,
} from "./trade/pathofexile-trade";
import { AppConfig, TipsFrequency } from "@/web/Config";
import { FilterPreset } from "./filters/interfaces";
import { PriceCheckWidget } from "../overlay/interfaces";
import { useLeagues } from "@/web/background/Leagues";
import { randomTip, TIP_FREQUENCY_MAP } from "../help/tips";

let _showSupportLinksCounter = 0;
let _showTipCounter = 15;

export default defineComponent({
  name: "CheckedItem",
  emits: ["item-editor-selection"],
  components: {
    PricePrediction,
    TradeListing,
    TradeBulk,
    TradeLinks,
    CalculatedResult,
    PriceTrend,
    FiltersBlock,
    FilterName,
    StackValue,
    Tip,
  },
  props: {
    item: {
      type: Object as PropType<ParsedItem>,
      required: true,
    },
    advancedCheck: {
      type: Boolean,
      required: true,
    },
    rebuildKey: {
      type: Number,
      required: true,
    },
  },
  setup(props, ctx) {
    const widget = computed(() => AppConfig<PriceCheckWidget>("price-check")!);
    const leagues = useLeagues();
    const lang = computed(() => AppConfig().language);

    const presets = ref<{ active: string; presets: FilterPreset[] }>(null!);
    const itemFilters = computed(
      () =>
        presets.value.presets.find(
          (preset) => preset.id === presets.value.active,
        )!.filters,
    );
    const itemStats = computed(
      () =>
        presets.value.presets.find(
          (preset) => preset.id === presets.value.active,
        )!.stats,
    );
    const weightFilters = computed(
      () =>
        presets.value.presets.find(
          (preset) => preset.id === presets.value.active,
        )!.weightFilters,
    );
    const doSearch = ref(false);
    const tradeAPI = ref<"trade" | "bulk">("bulk");

    // TradeListing.vue OR TradeBulk.vue
    const tradeService = ref<{ execSearch(): void } | null>(null);
    // FiltersBlock.vue
    const filtersComponent = ref<ComponentPublicInstance>(null!);

    watch(
      () => props.item,
      (item, prevItem) => {
        const prevCurrency =
          presets.value != null ? itemFilters.value.trade.currency : undefined;
        const prevCurrencyRatio =
          presets.value != null
            ? itemFilters.value.trade.currencyRatio
            : undefined;

        presets.value = createPresets(item, {
          league: leagues.selectedId.value!,
          collapseListings: widget.value.collapseListings,
          activateStockFilter: widget.value.activateStockFilter,
          searchStatRange: widget.value.searchStatRange,
          useEn:
            (AppConfig().language === "cmn-Hant" &&
              AppConfig().realm === "pc-ggg") ||
            AppConfig().preferredTradeSite === "www",
          currency:
            widget.value.rememberCurrency ||
            (prevItem &&
              item.info.namespace === prevItem.info.namespace &&
              item.info.refName === prevItem.info.refName)
              ? prevCurrency
              : undefined,
          usePseudo:
            widget.value.usePseudo &&
            ["en", "ru", "ko", "cmn-Hant"].includes(lang.value),
          defaultAllSelected: widget.value.defaultAllSelected,
          autoFillEmptyRuneSockets: widget.value.autoFillEmptyRuneSockets,
          currencyRatio:
            widget.value.rememberRatio ||
            (prevItem &&
              item.info.namespace === prevItem.info.namespace &&
              item.info.refName === prevItem.info.refName)
              ? prevCurrencyRatio
              : undefined,
        });

        if (
          (!props.advancedCheck && !widget.value.smartInitialSearch) ||
          (props.advancedCheck && !widget.value.lockedInitialSearch)
        ) {
          doSearch.value = false;
        } else {
          doSearch.value = Boolean(
            item.rarity === ItemRarity.Unique ||
              item.category === ItemCategory.Map ||
              item.category === ItemCategory.HeistBlueprint ||
              item.category === ItemCategory.SanctumRelic ||
              item.category === ItemCategory.Charm ||
              !CATEGORY_TO_TRADE_ID.has(item.category!) ||
              item.isUnidentified ||
              item.isVeiled,
          );
        }

        tradeAPI.value = apiToSatisfySearch(
          props.item,
          itemStats.value,
          itemFilters.value,
        );
      },
      { immediate: true, deep: true },
    );

    watch(
      () => [props.item, doSearch.value],
      () => {
        if (doSearch.value === false) return;

        tradeAPI.value = apiToSatisfySearch(
          props.item,
          itemStats.value,
          itemFilters.value,
        );

        // NOTE: child `trade-xxx` component renders/receives props on nextTick
        nextTick(() => {
          if (tradeService.value) {
            tradeService.value.execSearch();
          }
        });
      },
      { deep: false, immediate: true },
    );

    watch(
      () => [props.item, doSearch.value, itemStats.value, itemFilters.value],
      (curr, prev) => {
        const cItem = curr[0];
        const pItem = prev[0];
        const cIntaracted = curr[1];
        const pIntaracted = prev[1];

        if (cItem === pItem && cIntaracted === true && pIntaracted === true) {
          // force user to press Search button on change
          doSearch.value = false;
        }
      },
      { deep: true },
    );

    watch(
      () => [props.item, JSON.stringify(itemFilters.value.trade)],
      (curr, prev) => {
        const cItem = curr[0];
        const pItem = prev[0];
        const cTrade = curr[1];
        const pTrade = prev[1];

        if (cItem === pItem && cTrade !== pTrade) {
          nextTick(() => {
            doSearch.value = true;
          });
        }
      },
      { deep: false },
    );

    const showPredictedPrice = computed(() => {
      if (
        !widget.value.requestPricePrediction ||
        AppConfig().language !== "en" ||
        !leagues.selected.value!.isPopular
      )
        return false;

      if (presets.value.active === "filters.preset_base_item") return false;

      return (
        props.item.rarity === ItemRarity.Rare &&
        props.item.category !== ItemCategory.Map &&
        props.item.category !== ItemCategory.CapturedBeast &&
        props.item.category !== ItemCategory.HeistContract &&
        props.item.category !== ItemCategory.HeistBlueprint &&
        props.item.category !== ItemCategory.Invitation &&
        props.item.info.refName !== "Expedition Logbook" &&
        !props.item.isUnidentified
      );
    });

    const show = computed(() => {
      return !(
        props.item.rarity === ItemRarity.Unique &&
        props.item.isUnidentified &&
        props.item.info.unique == null
      );
    });

    function handleSearchMouseenter(e: MouseEvent) {
      if (
        (filtersComponent.value.$el as HTMLElement).contains(
          e.relatedTarget as HTMLElement,
        )
      ) {
        doSearch.value = true;

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    }

    const showSupportLinks = ref(false);
    const showTip = ref(0);
    watch(
      () => [props.item, doSearch.value],
      ([cItem, cInteracted], [pItem]) => {
        if (
          _showSupportLinksCounter >= 13 &&
          (!cInteracted || tradeAPI.value === "bulk")
        ) {
          showSupportLinks.value = true;
          _showSupportLinksCounter = 0;
        } else {
          showSupportLinks.value = false;
          if (
            AppConfig().tipsFrequency !== TipsFrequency.Never &&
            (AppConfig().tipsFrequency === TipsFrequency.Always ||
              _showTipCounter >=
                TIP_FREQUENCY_MAP[AppConfig().tipsFrequency]) &&
            !cInteracted
          ) {
            _showTipCounter = 0;
            showTip.value = randomTip();
          } else {
            showTip.value = 0;
            if (cItem !== pItem) {
              _showTipCounter += 1;
            }
          }

          if (cItem !== pItem) {
            _showSupportLinksCounter += 1;
          }
        }
      },
    );

    watch(
      () => itemFilters.value.itemEditorSelection,
      (val) => {
        ctx.emit("item-editor-selection", val);
      },
      { deep: true },
    );

    const { t } = useI18n();

    return {
      t,
      itemFilters,
      itemStats,
      weightFilters,
      doSearch,
      tradeAPI,
      tradeService,
      filtersComponent,
      showPredictedPrice,
      showTip,
      show,
      handleSearchMouseenter,
      showSupportLinks,
      presets: computed(() =>
        presets.value.presets.map((preset) => ({
          id: preset.id,
          active: preset.id === presets.value.active,
        })),
      ),
      selectPreset(id: string) {
        presets.value.active = id;
      },
      showPseudoLink: computed(
        () =>
          weightFilters.value.length &&
          !(
            widget.value.usePseudo &&
            ["en", "ru", "ko", "cmn-Hant"].includes(AppConfig().language)
          ),
      ),
      makeTradeLink() {
        return `https://${getTradeEndpoint()}/trade2/search/poe2/${itemFilters.value.trade.league}?q=${JSON.stringify(createTradeRequest(itemFilters.value, itemStats.value, props.item))}`;
      },
      makeTradeLinkPseudo() {
        return `https://${getTradeEndpoint()}/trade2/search/poe2/${itemFilters.value.trade.league}?q=${JSON.stringify(createTradeRequest(itemFilters.value, itemStats.value, props.item, weightFilters.value))}`;
      },
    };
  },
});
</script>
