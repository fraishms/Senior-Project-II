import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProgressiveTariff1770000001000 implements MigrationInterface {
  name = "AddProgressiveTariff1770000001000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE users ADD COLUMN tariff_mode ENUM('tiered','flat_override') NOT NULL DEFAULT 'tiered'");
    await queryRunner.query("ALTER TABLE users ADD COLUMN tier_limit_kwh DECIMAL(10,2) NOT NULL DEFAULT 6000.00");
    await queryRunner.query("ALTER TABLE users ADD COLUMN high_rate_per_kwh DECIMAL(6,4) NOT NULL DEFAULT 0.3000");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE users DROP COLUMN high_rate_per_kwh");
    await queryRunner.query("ALTER TABLE users DROP COLUMN tier_limit_kwh");
    await queryRunner.query("ALTER TABLE users DROP COLUMN tariff_mode");
  }
}
