import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { AuthorizationValue } from '../auth/decorators/authorization-value.decorator';
import { CartService, CartView, CreatedCart } from './cart.service';
import { SetCartItemDto } from './dto/set-cart-item.dto';

@Controller('carts')
export class CartController {
  constructor(private readonly carts: CartService) {}

  @Post()
  createCart(@AuthorizationValue() authorization?: string): Promise<CreatedCart> {
    return this.carts.createCart(authorization);
  }

  @Get(':cartId')
  getCart(
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<CartView> {
    return this.carts.getCart(cartId, authorization, guestToken);
  }

  @Put(':cartId/items')
  setItem(
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Body() input: SetCartItemDto,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<CartView> {
    return this.carts.setItem(cartId, input, authorization, guestToken);
  }

  @Delete(':cartId/items/:variantId')
  removeItem(
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<CartView> {
    return this.carts.removeItem(cartId, variantId, authorization, guestToken);
  }
}
