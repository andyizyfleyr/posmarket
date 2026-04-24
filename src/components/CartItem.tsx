'use client';

import React, { memo, useCallback } from 'react';
import { CartItem as ICartItem } from '@/types';
import { Trash2, Plus, Minus } from 'lucide-react';
import { formatCurrency } from '@/utils';
import ProductImage from './ProductImage';

interface CartItemProps {
  item: ICartItem;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}

const CartItem: React.FC<CartItemProps> = memo(({ item, onUpdateQuantity, onRemove }) => {
  const handleUpdateQuantity = useCallback((delta: number) => {
    onUpdateQuantity(item.product.id, delta);
  }, [item.product.id, onUpdateQuantity]);

  const handleRemove = useCallback(() => {
    onRemove(item.product.id);
  }, [item.product.id, onRemove]);

  return (
    <div className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0 group items-center">
      <div className="w-10 h-10 flex-shrink-0">
        <ProductImage
          src={item.product.image}
          alt={item.product.name}
          containerClassName="rounded-lg border border-gray-100 shadow-sm"
          showZoomEffect={false}
        />
      </div>

      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start gap-1.5 px-0.5">
          <div className="min-w-0 flex-grow">
            <h4 className="text-[11px] md:text-xs font-bold text-gray-800 truncate leading-none mb-1">
              {item.product.name}
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-[#f56b2a] font-black bg-orange-50 px-1 rounded leading-none py-0.5 whitespace-nowrap">
                {formatCurrency(item.product.price)}
                {item.product.unit && item.product.unit !== 'pièce' && <span className="text-gray-400 font-medium ml-0.5">/{item.product.unit}</span>}
              </span>
              <span className="text-[10px] font-black text-gray-900 border-l border-gray-100 pl-1.5">
                {formatCurrency(item.product.price * item.quantity)}
              </span>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="text-gray-300 hover:text-red-500 transition-colors p-1"
          >
            <Trash2 size={12} />
          </button>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center bg-gray-100 rounded-md overflow-hidden h-6.5 p-0.5">
            <button
              onClick={() => handleUpdateQuantity(-1)}
              className="w-5.5 h-5.5 flex items-center justify-center rounded bg-white shadow-sm text-gray-600 active:scale-90 transition-transform"
            >
              <Minus size={10} />
            </button>
            <span className="px-2 min-w-[1.5rem] text-center text-[10px] md:text-xs font-black text-gray-800 leading-none">
              {item.quantity}
            </span>
            <button
              onClick={() => handleUpdateQuantity(1)}
              className="w-5.5 h-5.5 flex items-center justify-center rounded bg-white shadow-sm text-gray-600 active:scale-90 transition-transform"
            >
              <Plus size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

CartItem.displayName = 'CartItem';

export default CartItem;

