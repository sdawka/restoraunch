import { ref, onMounted } from 'vue'
import { getSampleData, type RestaurantType, type SampleDataSet } from '../data/sample-data'

const SAMPLE_MODE_KEY = 'restoraunch_sample_mode'

const isInSampleMode = ref(false)
const restaurantType = ref<RestaurantType | null>(null)

export function useSampleData() {
  onMounted(() => {
    const storedType = sessionStorage.getItem(SAMPLE_MODE_KEY)
    if (storedType && ['fast_casual', 'fine_dining', 'bar_brewery', 'cafe', 'food_truck'].includes(storedType)) {
      isInSampleMode.value = true
      restaurantType.value = storedType as RestaurantType
    }
  })

  function getSampleDataForType(): SampleDataSet | null {
    if (!isInSampleMode.value || !restaurantType.value) return null
    return getSampleData(restaurantType.value)
  }

  function exitSampleMode() {
    sessionStorage.removeItem(SAMPLE_MODE_KEY)
    isInSampleMode.value = false
    restaurantType.value = null
  }

  function getRestaurantTypeLabel(): string {
    const labels: Record<RestaurantType, string> = {
      fast_casual: 'Fast Casual',
      fine_dining: 'Fine Dining',
      bar_brewery: 'Bar / Brewery',
      cafe: 'Café',
      food_truck: 'Food Truck',
    }
    return restaurantType.value ? labels[restaurantType.value] : ''
  }

  return {
    isInSampleMode,
    restaurantType,
    getSampleDataForType,
    exitSampleMode,
    getRestaurantTypeLabel,
  }
}
