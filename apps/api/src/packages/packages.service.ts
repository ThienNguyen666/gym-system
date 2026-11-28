import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackageType } from '../entities/enums';
import { Package } from '../entities/package.entity';
import { CreatePackageDto, UpdatePackageDto } from './packages.dto';

@Injectable()
export class PackagesService {
  constructor(@InjectRepository(Package) private repo: Repository<Package>) {}

  list(onlyActive: boolean) {
    return this.repo.find({ where: onlyActive ? { isActive: true } : {}, order: { price: 'ASC' } });
  }

  create(d: CreatePackageDto) {
    if (d.type === PackageType.DURATION && !d.durationDays) throw new BadRequestException('Gói theo thời hạn cần durationDays');
    if (d.type === PackageType.SESSIONS && !d.totalSessions) throw new BadRequestException('Gói theo số buổi cần totalSessions');
    return this.repo.save(this.repo.create({
      name: d.name.trim(),
      type: d.type,
      price: d.price.toFixed(2),
      durationDays: d.type === PackageType.DURATION ? d.durationDays! : null,
      totalSessions: d.type === PackageType.SESSIONS ? d.totalSessions! : null,
    }));
  }

  async update(id: string, d: UpdatePackageDto) {
    const p = await this.repo.findOneBy({ id });
    if (!p) throw new NotFoundException('Không tìm thấy gói');
    if (d.name !== undefined) p.name = d.name.trim();
    if (d.price !== undefined) p.price = d.price.toFixed(2);
    if (d.isActive !== undefined) p.isActive = d.isActive;
    return this.repo.save(p);
  }
}