import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "alerts" })
export class Alert {
  @PrimaryGeneratedColumn({ name: "alert_id", type: "int", unsigned: true }) alertId!: number;
  @Column({ name: "user_id", type: "int", unsigned: true }) userId!: number;
  @Column({ name: "alert_type", type: "varchar", length: 50 }) alertType!: string;
  @Column({ type: "varchar", length: 500 }) message!: string;
  @CreateDateColumn({ name: "created_at", type: "datetime" }) createdAt!: Date;
}
