import { Mapper } from '../Mapper';
import { Wishlist, WishlistItem } from './wishlist';

/**
 * Specialized mapper interface for transforming between external cart data sources
 * and the internal Wishlist model.
 *
 * @template SOURCE_TYPE - The external cart data format (typically from an API or data source)
 * @template SOURCE_ITEM_TYPE - The external cart item format
 * @extends {Mapper<SOURCE_TYPE, Wishlist>} - Extends the generic Mapper interface with Wishlist as the service type
 */
export interface WishlistMapper<SOURCE_TYPE, SOURCE_ITEM_TYPE> extends Mapper<SOURCE_TYPE, Wishlist> {
  /**
   * Maps an external cart item to a service wishlist item
   *
   * @param sourceCart - The cart in source format (provides currency context)
   * @param sourceItem - The cart item in source format
   * @returns The wishlist item in service format
   */
  mapWishlistItemToService(sourceCart: SOURCE_TYPE, sourceItem: SOURCE_ITEM_TYPE): WishlistItem;
}
