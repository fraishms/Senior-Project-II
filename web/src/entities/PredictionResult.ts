import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "prediction_results" })
@Unique("uq_prediction_user_month", ["userId", "predictionMonth"])
export class PredictionResult {
  @PrimaryGeneratedColumn({ name: "prediction_id", type: "int", unsigned: true }) predictionId!: number;
  @Column({ name: "user_id", type: "int", unsigned: true }) userId!: number;
  @Column({ name: "prediction_month", type: "date" }) predictionMonth!: string;
  @Column({ name: "predicted_units", type: "decimal", precision: 10, scale: 2 }) predictedUnits!: number;
  @Column({ name: "predicted_bill", type: "decimal", precision: 10, scale: 2 }) predictedBill!: number;
  @CreateDateColumn({ name: "generated_at", type: "datetime" }) generatedAt!: Date;
}
