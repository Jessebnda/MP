import { logInfo, logError } from '../../../../utils/logger';
import { 
  getProductById, 
  verifyStockForOrder, 
  updateStockAfterOrder 
} from '../../../../lib/productService';

export { getProductById, verifyStockForOrder, updateStockAfterOrder };