import { Injectable } from '@nestjs/common';
import { CreateNoshowDto } from './dto/create-noshow.dto.js';
import { UpdateNoshowDto } from './dto/update-noshow.dto.js';

@Injectable()
export class NoshowService {
  create(createNoshowDto: CreateNoshowDto) {
    return 'This action adds a new noshow';
  }

  findAll() {
    return `This action returns all noshow`;
  }

  findOne(id: number) {
    return `This action returns a #${id} noshow`;
  }

  update(id: number, updateNoshowDto: UpdateNoshowDto) {
    return `This action updates a #${id} noshow`;
  }

  remove(id: number) {
    return `This action removes a #${id} noshow`;
  }
}
