import { Booking } from './booking.entity';
import { CheckIn } from './check-in.entity';
import { GymClass } from './gym-class.entity';
import { MemberPackage } from './member-package.entity';
import { MemberProfile } from './member-profile.entity';
import { Package } from './package.entity';
import { Payment } from './payment.entity';
import { RefreshToken } from './refresh-token.entity';
import { TrainerAvailability } from './trainer-availability.entity';
import { TrainerProfile } from './trainer-profile.entity';
import { User } from './user.entity';
import { WaitlistEntry } from './waitlist-entry.entity';

// Thêm entity mới thì nhớ thêm vào đây
export const ALL_ENTITIES = [
  User, RefreshToken, MemberProfile, TrainerProfile, Package, MemberPackage,
  GymClass, Booking, WaitlistEntry, CheckIn, Payment, TrainerAvailability,
];