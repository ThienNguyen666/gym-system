import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1795836985483 implements MigrationInterface {
    name = 'Init1795836985483'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."Users_role_enum" AS ENUM('admin', 'manager', 'trainer', 'member')`);
        await queryRunner.query(`CREATE TYPE "public"."Users_status_enum" AS ENUM('active', 'disabled')`);
        await queryRunner.query(`CREATE TABLE "Users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "full_name" character varying NOT NULL, "role" "public"."Users_role_enum" NOT NULL, "status" "public"."Users_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_3c3ab3f49a87e6ddb607f3c4945" UNIQUE ("email"), CONSTRAINT "PK_16d4f7d636df336db11d87413e3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "TrainerProfiles" ("user_id" uuid NOT NULL, "specialization" character varying, CONSTRAINT "PK_ffda67ca90cf3065e6715229e85" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."GymClasses_status_enum" AS ENUM('scheduled', 'cancelled', 'completed')`);
        await queryRunner.query(`CREATE TABLE "GymClasses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying NOT NULL, "trainer_id" uuid, "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, "end_time" TIMESTAMP WITH TIME ZONE NOT NULL, "capacity" integer NOT NULL, "confirmed_count" integer NOT NULL DEFAULT '0', "status" "public"."GymClasses_status_enum" NOT NULL DEFAULT 'scheduled', CONSTRAINT "chk_class_confirmed" CHECK (confirmed_count >= 0 AND confirmed_count <= capacity), CONSTRAINT "chk_class_time" CHECK (end_time > start_time), CONSTRAINT "chk_class_capacity" CHECK (capacity > 0), CONSTRAINT "PK_0c116ea7f6b8e2eb8d66c5e2737" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_class_start" ON "GymClasses"  ("start_time") `);
        await queryRunner.query(`CREATE TABLE "MemberProfiles" ("user_id" uuid NOT NULL, "join_date" date NOT NULL, CONSTRAINT "PK_3577fa975973ec11d96dfafd073" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."Packages_type_enum" AS ENUM('duration', 'sessions')`);
        await queryRunner.query(`CREATE TABLE "Packages" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "type" "public"."Packages_type_enum" NOT NULL, "price" numeric(12,2) NOT NULL, "duration_days" integer, "total_sessions" integer, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "chk_package_price" CHECK (price >= 0), CONSTRAINT "PK_2c81b9c345c28dbba72e54bfc0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."MemberPackages_status_enum" AS ENUM('pending', 'active', 'expired', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "MemberPackages" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "member_id" uuid NOT NULL, "package_id" uuid NOT NULL, "start_date" date NOT NULL, "end_date" date, "sessions_remaining" integer, "pending_count" integer NOT NULL DEFAULT '0', "status" "public"."MemberPackages_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_mp_pending" CHECK (pending_count >= 0 AND pending_count <= sessions_remaining), CONSTRAINT "chk_mp_sessions" CHECK (sessions_remaining >= 0), CONSTRAINT "PK_244635d41e068ef2633b41b6008" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_member_one_active_package" ON "MemberPackages"  ("member_id") WHERE "status" = 'active'`);
        await queryRunner.query(`CREATE TYPE "public"."Bookings_status_enum" AS ENUM('confirmed', 'cancelled', 'completed', 'no_show')`);
        await queryRunner.query(`CREATE TABLE "Bookings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "member_id" uuid NOT NULL, "class_id" uuid NOT NULL, "member_package_id" uuid, "status" "public"."Bookings_status_enum" NOT NULL DEFAULT 'confirmed', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cancelled_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_383e0a5652b33012e15e1d0192a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_booking_member" ON "Bookings"  ("member_id") `);
        await queryRunner.query(`CREATE INDEX "idx_booking_class_status" ON "Bookings"  ("class_id", "status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_booking_member_class_confirmed" ON "Bookings"  ("member_id", "class_id") WHERE "status" = 'confirmed'`);
        await queryRunner.query(`CREATE TYPE "public"."CheckIns_method_enum" AS ENUM('qr', 'manual')`);
        await queryRunner.query(`CREATE TABLE "CheckIns" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "booking_id" uuid NOT NULL, "checked_in_at" TIMESTAMP WITH TIME ZONE NOT NULL, "checked_in_by" uuid NOT NULL, "method" "public"."CheckIns_method_enum" NOT NULL, CONSTRAINT "UQ_a8e6c2eb25dc8edc08a67d5b38e" UNIQUE ("booking_id"), CONSTRAINT "REL_a8e6c2eb25dc8edc08a67d5b38" UNIQUE ("booking_id"), CONSTRAINT "PK_77240cd7d1f29a3b5cef6a64a39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."Payments_method_enum" AS ENUM('cash', 'transfer')`);
        await queryRunner.query(`CREATE TYPE "public"."Payments_status_enum" AS ENUM('paid', 'refunded')`);
        await queryRunner.query(`CREATE TABLE "Payments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "member_package_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "method" "public"."Payments_method_enum" NOT NULL, "status" "public"."Payments_status_enum" NOT NULL DEFAULT 'paid', "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL, "recorded_by" uuid NOT NULL, CONSTRAINT "chk_payment_amount" CHECK (amount > 0), CONSTRAINT "PK_50c3077812277d7b8c68c54d61a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "RefreshTokens" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_07ff4bc1b9063ed3401f15aea10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "TrainerAvailability" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "trainer_id" uuid NOT NULL, "day_of_week" integer NOT NULL, "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, CONSTRAINT "chk_avail_dow" CHECK (day_of_week BETWEEN 0 AND 6), CONSTRAINT "PK_dfa639d007e4b2282aa630e5d73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."WaitlistEntries_status_enum" AS ENUM('waiting', 'promoted', 'expired', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "WaitlistEntries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "member_id" uuid NOT NULL, "class_id" uuid NOT NULL, "status" "public"."WaitlistEntries_status_enum" NOT NULL DEFAULT 'waiting', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "promoted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_bd4139c452898dd27eb52e5b21e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_waitlist_class_status_created" ON "WaitlistEntries"  ("class_id", "status", "created_at") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_waitlist_member_class_waiting" ON "WaitlistEntries"  ("member_id", "class_id") WHERE "status" = 'waiting'`);
        await queryRunner.query(`ALTER TABLE "TrainerProfiles" ADD CONSTRAINT "FK_ffda67ca90cf3065e6715229e85" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "GymClasses" ADD CONSTRAINT "FK_97af912116cf886d06343bf11ca" FOREIGN KEY ("trainer_id") REFERENCES "TrainerProfiles"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "MemberProfiles" ADD CONSTRAINT "FK_3577fa975973ec11d96dfafd073" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "MemberPackages" ADD CONSTRAINT "FK_7d4094b791521c3e83b778ae4b5" FOREIGN KEY ("member_id") REFERENCES "MemberProfiles"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "MemberPackages" ADD CONSTRAINT "FK_196c6b3f488445a9258efdad934" FOREIGN KEY ("package_id") REFERENCES "Packages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Bookings" ADD CONSTRAINT "FK_9dfd8e6580948c8c660498ccf41" FOREIGN KEY ("member_id") REFERENCES "MemberProfiles"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Bookings" ADD CONSTRAINT "FK_74335c5ec7bcb9c18c3a01d8b0a" FOREIGN KEY ("class_id") REFERENCES "GymClasses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Bookings" ADD CONSTRAINT "FK_6e3cec8e050b30542e4f580556a" FOREIGN KEY ("member_package_id") REFERENCES "MemberPackages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "CheckIns" ADD CONSTRAINT "FK_a8e6c2eb25dc8edc08a67d5b38e" FOREIGN KEY ("booking_id") REFERENCES "Bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "CheckIns" ADD CONSTRAINT "FK_e65682f49bcc7df6498fa30e3c9" FOREIGN KEY ("checked_in_by") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Payments" ADD CONSTRAINT "FK_4e76dd995e7511adc438fc36229" FOREIGN KEY ("member_package_id") REFERENCES "MemberPackages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Payments" ADD CONSTRAINT "FK_91a82c8d852ed705a155940de88" FOREIGN KEY ("recorded_by") REFERENCES "Users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "TrainerAvailability" ADD CONSTRAINT "FK_c32cf3c767059d66eb9242c53b3" FOREIGN KEY ("trainer_id") REFERENCES "TrainerProfiles"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "WaitlistEntries" ADD CONSTRAINT "FK_1754028ebb55f35dfd80817436f" FOREIGN KEY ("member_id") REFERENCES "MemberProfiles"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "WaitlistEntries" ADD CONSTRAINT "FK_e8dd72d12757c82735f7ff6602c" FOREIGN KEY ("class_id") REFERENCES "GymClasses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "WaitlistEntries" DROP CONSTRAINT "FK_e8dd72d12757c82735f7ff6602c"`);
        await queryRunner.query(`ALTER TABLE "WaitlistEntries" DROP CONSTRAINT "FK_1754028ebb55f35dfd80817436f"`);
        await queryRunner.query(`ALTER TABLE "TrainerAvailability" DROP CONSTRAINT "FK_c32cf3c767059d66eb9242c53b3"`);
        await queryRunner.query(`ALTER TABLE "Payments" DROP CONSTRAINT "FK_91a82c8d852ed705a155940de88"`);
        await queryRunner.query(`ALTER TABLE "Payments" DROP CONSTRAINT "FK_4e76dd995e7511adc438fc36229"`);
        await queryRunner.query(`ALTER TABLE "CheckIns" DROP CONSTRAINT "FK_e65682f49bcc7df6498fa30e3c9"`);
        await queryRunner.query(`ALTER TABLE "CheckIns" DROP CONSTRAINT "FK_a8e6c2eb25dc8edc08a67d5b38e"`);
        await queryRunner.query(`ALTER TABLE "Bookings" DROP CONSTRAINT "FK_6e3cec8e050b30542e4f580556a"`);
        await queryRunner.query(`ALTER TABLE "Bookings" DROP CONSTRAINT "FK_74335c5ec7bcb9c18c3a01d8b0a"`);
        await queryRunner.query(`ALTER TABLE "Bookings" DROP CONSTRAINT "FK_9dfd8e6580948c8c660498ccf41"`);
        await queryRunner.query(`ALTER TABLE "MemberPackages" DROP CONSTRAINT "FK_196c6b3f488445a9258efdad934"`);
        await queryRunner.query(`ALTER TABLE "MemberPackages" DROP CONSTRAINT "FK_7d4094b791521c3e83b778ae4b5"`);
        await queryRunner.query(`ALTER TABLE "MemberProfiles" DROP CONSTRAINT "FK_3577fa975973ec11d96dfafd073"`);
        await queryRunner.query(`ALTER TABLE "GymClasses" DROP CONSTRAINT "FK_97af912116cf886d06343bf11ca"`);
        await queryRunner.query(`ALTER TABLE "TrainerProfiles" DROP CONSTRAINT "FK_ffda67ca90cf3065e6715229e85"`);
        await queryRunner.query(`DROP INDEX "public"."uq_waitlist_member_class_waiting"`);
        await queryRunner.query(`DROP INDEX "public"."idx_waitlist_class_status_created"`);
        await queryRunner.query(`DROP TABLE "WaitlistEntries"`);
        await queryRunner.query(`DROP TYPE "public"."WaitlistEntries_status_enum"`);
        await queryRunner.query(`DROP TABLE "TrainerAvailability"`);
        await queryRunner.query(`DROP TABLE "RefreshTokens"`);
        await queryRunner.query(`DROP TABLE "Payments"`);
        await queryRunner.query(`DROP TYPE "public"."Payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."Payments_method_enum"`);
        await queryRunner.query(`DROP TABLE "CheckIns"`);
        await queryRunner.query(`DROP TYPE "public"."CheckIns_method_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_booking_member_class_confirmed"`);
        await queryRunner.query(`DROP INDEX "public"."idx_booking_class_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_booking_member"`);
        await queryRunner.query(`DROP TABLE "Bookings"`);
        await queryRunner.query(`DROP TYPE "public"."Bookings_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_member_one_active_package"`);
        await queryRunner.query(`DROP TABLE "MemberPackages"`);
        await queryRunner.query(`DROP TYPE "public"."MemberPackages_status_enum"`);
        await queryRunner.query(`DROP TABLE "Packages"`);
        await queryRunner.query(`DROP TYPE "public"."Packages_type_enum"`);
        await queryRunner.query(`DROP TABLE "MemberProfiles"`);
        await queryRunner.query(`DROP INDEX "public"."idx_class_start"`);
        await queryRunner.query(`DROP TABLE "GymClasses"`);
        await queryRunner.query(`DROP TYPE "public"."GymClasses_status_enum"`);
        await queryRunner.query(`DROP TABLE "TrainerProfiles"`);
        await queryRunner.query(`DROP TABLE "Users"`);
        await queryRunner.query(`DROP TYPE "public"."Users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."Users_role_enum"`);
    }

}
