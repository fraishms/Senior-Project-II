import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1770000000000 implements MigrationInterface {
  name = "InitialSchema1770000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE users (
      user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      price_per_kwh DECIMAL(6,4) NOT NULL DEFAULT 0.1800,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id), UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE consumption_records (
      record_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      week_start DATE NOT NULL,
      units_consumed DECIMAL(10,2) NOT NULL,
      bill_amount DECIMAL(10,2) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (record_id), UNIQUE KEY uq_user_week (user_id, week_start),
      KEY idx_cons_user (user_id, week_start),
      CONSTRAINT fk_cons_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT chk_units_nonneg CHECK (units_consumed >= 0)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE prediction_results (
      prediction_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      prediction_month DATE NOT NULL,
      predicted_units DECIMAL(10,2) NOT NULL,
      predicted_bill DECIMAL(10,2) NOT NULL,
      generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (prediction_id), UNIQUE KEY uq_prediction_user_month (user_id, prediction_month),
      KEY idx_pred_user (user_id, generated_at),
      CONSTRAINT fk_pred_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE alerts (
      alert_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      alert_type VARCHAR(50) NOT NULL,
      message VARCHAR(500) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (alert_id), KEY idx_alert_user (user_id, created_at),
      CONSTRAINT fk_alert_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE alerts");
    await queryRunner.query("DROP TABLE prediction_results");
    await queryRunner.query("DROP TABLE consumption_records");
    await queryRunner.query("DROP TABLE users");
  }
}
